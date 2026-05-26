// ============================================================================
// RedisService — JWT blacklist, rate limiting, sessions
// ============================================================================
// Acepta configuración via:
//   - REDIS_URL  (Render provee esto automáticamente)
//   - REDIS_HOST + REDIS_PORT + REDIS_PASSWORD (Docker Compose local)
// ============================================================================

import { Global, Module, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (redisUrl) {
      // Render provee REDIS_URL directamente (rediss://... o redis://...)
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      });
    } else {
      // Fallback para Docker Compose local (usa host/port/password por separado)
      this.client = new Redis({
        host: this.config.get<string>('REDIS_HOST', 'redis'),
        port: parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });
    }

    this.client.on('connect', () => this.logger.log('✅ Conectado a Redis'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err.message));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  // ----------------------------------------------------------------------
  // JWT BLACKLIST
  // ----------------------------------------------------------------------
  async blacklistJwt(jti: string, expiresInSeconds: number): Promise<void> {
    await this.client.setex(`blacklist:jwt:${jti}`, expiresInSeconds, '1');
  }

  async isJwtBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:jwt:${jti}`);
    return result !== null;
  }

  // ----------------------------------------------------------------------
  // FAILED LOGIN COUNTER (por email)
  // ----------------------------------------------------------------------
  async incrementFailedLogin(email: string, ttlSeconds = 900): Promise<number> {
    const key = `failed_login:${email.toLowerCase()}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async resetFailedLogin(email: string): Promise<void> {
    await this.client.del(`failed_login:${email.toLowerCase()}`);
  }

  async getFailedLoginCount(email: string): Promise<number> {
    const result = await this.client.get(`failed_login:${email.toLowerCase()}`);
    return result ? parseInt(result, 10) : 0;
  }

  // ----------------------------------------------------------------------
  // EMAIL VERIFICATION TOKENS (1 hora TTL)
  // ----------------------------------------------------------------------
  async storeEmailVerificationToken(token: string, userId: string): Promise<void> {
    await this.client.setex(`verify:email:${token}`, 3600, userId);
  }

  async getEmailVerificationUser(token: string): Promise<string | null> {
    return this.client.get(`verify:email:${token}`);
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    await this.client.del(`verify:email:${token}`);
  }

  // ----------------------------------------------------------------------
  // PASSWORD RESET TOKENS (15 min TTL)
  // ----------------------------------------------------------------------
  async storePasswordResetToken(token: string, userId: string): Promise<void> {
    await this.client.setex(`reset:password:${token}`, 900, userId);
  }

  async getPasswordResetUser(token: string): Promise<string | null> {
    return this.client.get(`reset:password:${token}`);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await this.client.del(`reset:password:${token}`);
  }

  // ----------------------------------------------------------------------
  // GENERIC GET/SET
  // ----------------------------------------------------------------------
  getClient(): Redis {
    return this.client;
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
