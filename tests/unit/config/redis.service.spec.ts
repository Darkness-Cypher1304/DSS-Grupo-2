// ============================================================================
// Unit · RedisService — modo memoria (fallback) y modo Redis (ioredis mockeado)
// ============================================================================

import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisService } from '../../../src/config/redis.service';

jest.mock('ioredis');

function configMock(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string, def?: unknown) => (key in values ? values[key] : def),
  } as unknown as ConfigService;
}

describe('RedisService', () => {
  describe('modo MEMORIA (sin Redis configurado)', () => {
    let service: RedisService;

    beforeEach(() => {
      service = new RedisService(configMock({}));
      service.onModuleInit();
    });

    afterEach(async () => {
      await service.onModuleDestroy();
    });

    it('usa el backend en memoria (isRedis=false) y responde ping', async () => {
      expect(service.isRedis).toBe(false);
      await expect(service.ping()).resolves.toBe(true);
    });

    it('gestiona la blacklist de JWT', async () => {
      expect(await service.isJwtBlacklisted('jti-1')).toBe(false);
      await service.blacklistJwt('jti-1', 60);
      expect(await service.isJwtBlacklisted('jti-1')).toBe(true);
    });

    it('cuenta y reinicia intentos de login fallidos', async () => {
      expect(await service.incrementFailedLogin('a@test.pe')).toBe(1);
      expect(await service.incrementFailedLogin('a@test.pe')).toBe(2);
      expect(await service.getFailedLoginCount('a@test.pe')).toBe(2);
      await service.resetFailedLogin('a@test.pe');
      expect(await service.getFailedLoginCount('a@test.pe')).toBe(0);
    });

    it('almacena y borra tokens de verificación y reset', async () => {
      await service.storeEmailVerificationToken('tokv', 'user-1');
      expect(await service.getEmailVerificationUser('tokv')).toBe('user-1');
      await service.deleteEmailVerificationToken('tokv');
      expect(await service.getEmailVerificationUser('tokv')).toBeNull();

      await service.storePasswordResetToken('tokr', 'user-2');
      expect(await service.getPasswordResetUser('tokr')).toBe('user-2');
      await service.deletePasswordResetToken('tokr');
      expect(await service.getPasswordResetUser('tokr')).toBeNull();
    });

    it('expira las entradas vencidas (TTL)', async () => {
      await service.blacklistJwt('jti-exp', 1);
      const realNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(realNow + 5000);
      expect(await service.isJwtBlacklisted('jti-exp')).toBe(false);
      (Date.now as jest.Mock).mockRestore();
    });
  });

  describe('modo REDIS (ioredis mockeado)', () => {
    const client = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    };
    let service: RedisService;

    beforeEach(() => {
      (Redis as unknown as jest.Mock).mockImplementation(() => client);
      service = new RedisService(configMock({ REDIS_URL: 'redis://localhost:6379' }));
      service.onModuleInit();
    });

    it('usa el backend Redis (isRedis=true) y delega en el cliente', async () => {
      expect(service.isRedis).toBe(true);

      await service.blacklistJwt('jti-9', 60);
      expect(client.setex).toHaveBeenCalledWith('blacklist:jwt:jti-9', 60, '1');

      client.get.mockResolvedValueOnce('1');
      expect(await service.isJwtBlacklisted('jti-9')).toBe(true);

      await expect(service.ping()).resolves.toBe(true);
    });

    it('ping retorna false si el cliente falla', async () => {
      client.ping.mockRejectedValueOnce(new Error('down'));
      await expect(service.ping()).resolves.toBe(false);
    });

    it('onModuleDestroy cierra el cliente', async () => {
      await service.onModuleDestroy();
      expect(client.quit).toHaveBeenCalled();
    });
  });
});
