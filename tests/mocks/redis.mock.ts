// ============================================================================
// Mock de RedisService — blacklist de JWT, contadores y tokens efímeros.
// Por defecto: NADA en blacklist y ping OK, para no bloquear el flujo de auth.
// ============================================================================

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

import { RedisService } from '../../src/config/redis.service';

export type RedisMock = DeepMockProxy<RedisService>;

function applyRedisDefaults(mock: RedisMock): void {
  mock.isJwtBlacklisted.mockResolvedValue(false);
  mock.ping.mockResolvedValue(true);
  mock.incrementFailedLogin.mockResolvedValue(1);
  mock.getFailedLoginCount.mockResolvedValue(0);
}

export function createRedisMock(): RedisMock {
  const mock = mockDeep<RedisService>();
  applyRedisDefaults(mock);
  return mock;
}

export function resetRedisMock(mock: RedisMock): void {
  mockReset(mock);
  applyRedisDefaults(mock);
}
