// ============================================================================
// RedisService — JWT blacklist, contadores, tokens efímeros
// ============================================================================
// Degradación elegante (sin servicios extra):
//   - Si hay Redis configurado (REDIS_URL o REDIS_HOST), lo usa.
//       · Docker Compose local: define REDIS_HOST/REDIS_URL → usa Redis.
//   - Si NO hay Redis (p.ej. Render con solo Postgres), usa un almacén EN
//     MEMORIA con la misma interfaz. Válido para una sola instancia: la
//     blacklist y los contadores viven en el proceso y se reinician al
//     reiniciar el servicio. Los access tokens duran ~15 min y la revocación
//     persistente de sesiones vive en Postgres (refresh_tokens), por lo que el
//     impacto es mínimo. El rate-limiting global usa su propio store en memoria.
// La API pública (blacklistJwt, isJwtBlacklisted, etc.) es idéntica en ambos
// modos: ningún otro módulo necesita cambiar.
// ============================================================================

import { Global, Module, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Operaciones mínimas que usa el servicio (subset de Redis).
interface CacheBackend {
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

// --------------------------------------------------------------------------
// Backend EN MEMORIA (fallback sin Redis). TTL por entrada; limpieza perezosa.
// --------------------------------------------------------------------------
class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  private alive(entry?: { value: string; expiresAt: number | null }): boolean {
    return !!entry && (entry.expiresAt === null || entry.expiresAt > Date.now());
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!this.alive(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry!.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const current = this.alive(entry) ? parseInt(entry!.value, 10) || 0 : 0;
    const next = current + 1;
    this.store.set(key, {
      value: String(next),
      expiresAt: this.alive(entry) ? entry!.expiresAt : null,
    });
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (this.alive(entry)) {
      entry!.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

// --------------------------------------------------------------------------
// Backend REDIS (envoltura de ioredis).
// --------------------------------------------------------------------------
class RedisBackend implements CacheBackend {
  constructor(private readonly client: Redis) {}

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }
  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }
  async ping(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }
  async close(): Promise<void> {
    await this.client.quit();
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private backend!: CacheBackend;
  private usingRedis = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisHost = this.config.get<string>('REDIS_HOST'); // sin default: ausente = no Redis

    if (redisUrl || redisHost) {
      const client = redisUrl
        ? new Redis(redisUrl, {
            retryStrategy: (times) => Math.min(times * 50, 2000),
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            tls: redisUrl.startsWith('rediss://') ? {} : undefined,
          })
        : new Redis({
            host: redisHost,
            port: parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10),
            password: this.config.get<string>('REDIS_PASSWORD') || undefined,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
          });

      client.on('connect', () => this.logger.log('✅ Conectado a Redis'));
      client.on('error', (err) => this.logger.error('Redis error:', err.message));

      this.backend = new RedisBackend(client);
      this.usingRedis = true;
    } else {
      this.backend = new MemoryBackend();
      this.usingRedis = false;
      this.logger.warn(
        '⚠️  Redis no configurado — usando almacén EN MEMORIA (válido para una sola instancia; ' +
          'la revocación persistente de sesiones vive en Postgres).',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.backend) {
      await this.backend.close();
    }
  }

  /** Indica si el backend activo es Redis (true) o memoria (false). */
  get isRedis(): boolean {
    return this.usingRedis;
  }

  /** Health check del backend de cache (true = sano). */
  ping(): Promise<boolean> {
    return this.backend.ping();
  }

  // ----------------------------------------------------------------------
  // JWT BLACKLIST
  // ----------------------------------------------------------------------
  async blacklistJwt(jti: string, expiresInSeconds: number): Promise<void> {
    await this.backend.setex(`blacklist:jwt:${jti}`, expiresInSeconds, '1');
  }

  async isJwtBlacklisted(jti: string): Promise<boolean> {
    const result = await this.backend.get(`blacklist:jwt:${jti}`);
    return result !== null;
  }

  // ----------------------------------------------------------------------
  // FAILED LOGIN COUNTER (por email)
  // ----------------------------------------------------------------------
  async incrementFailedLogin(email: string, ttlSeconds = 900): Promise<number> {
    const key = `failed_login:${email.toLowerCase()}`;
    const count = await this.backend.incr(key);
    if (count === 1) {
      await this.backend.expire(key, ttlSeconds);
    }
    return count;
  }

  async resetFailedLogin(email: string): Promise<void> {
    await this.backend.del(`failed_login:${email.toLowerCase()}`);
  }

  async getFailedLoginCount(email: string): Promise<number> {
    const result = await this.backend.get(`failed_login:${email.toLowerCase()}`);
    return result ? parseInt(result, 10) : 0;
  }

  // ----------------------------------------------------------------------
  // EMAIL VERIFICATION TOKENS (1 hora TTL)
  // ----------------------------------------------------------------------
  async storeEmailVerificationToken(token: string, userId: string): Promise<void> {
    await this.backend.setex(`verify:email:${token}`, 3600, userId);
  }

  async getEmailVerificationUser(token: string): Promise<string | null> {
    return this.backend.get(`verify:email:${token}`);
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    await this.backend.del(`verify:email:${token}`);
  }

  // ----------------------------------------------------------------------
  // PASSWORD RESET TOKENS (15 min TTL)
  // ----------------------------------------------------------------------
  async storePasswordResetToken(token: string, userId: string): Promise<void> {
    await this.backend.setex(`reset:password:${token}`, 900, userId);
  }

  async getPasswordResetUser(token: string): Promise<string | null> {
    return this.backend.get(`reset:password:${token}`);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await this.backend.del(`reset:password:${token}`);
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
