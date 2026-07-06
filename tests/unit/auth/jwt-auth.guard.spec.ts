// ============================================================================
// Unit · JwtAuthGuard — @Public, blacklist de Redis y handleRequest
// ============================================================================

import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { createExecutionContext } from '../../mocks/execution-context.mock';
import { createRedisMock, RedisMock } from '../../mocks/redis.mock';

function makeGuard(isPublic: boolean, redis: RedisMock): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector, redis);
}

// Prototipo de AuthGuard('jwt') — para simular la validación de Passport.
const authGuardProto = Object.getPrototypeOf(JwtAuthGuard.prototype);

describe('JwtAuthGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('permite sin validar si el endpoint es @Public()', async () => {
    const redis = createRedisMock();
    const guard = makeGuard(true, redis);
    const ctx = createExecutionContext({});

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(redis.isJwtBlacklisted).not.toHaveBeenCalled();
  });

  it('deniega si Passport no valida (super.canActivate=false)', async () => {
    jest.spyOn(authGuardProto, 'canActivate').mockResolvedValue(false);
    const guard = makeGuard(false, createRedisMock());
    const ctx = createExecutionContext({ request: { user: { jti: 'j', sub: 's' } } });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it('permite si el JWT es válido y NO está en blacklist', async () => {
    jest.spyOn(authGuardProto, 'canActivate').mockResolvedValue(true);
    const redis = createRedisMock();
    redis.isJwtBlacklisted.mockResolvedValue(false);
    const guard = makeGuard(false, redis);
    const ctx = createExecutionContext({ request: { user: { jti: 'j', sub: 's' } } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(redis.isJwtBlacklisted).toHaveBeenCalledWith('j');
  });

  it('deniega (401) si el JWT está en blacklist (token revocado)', async () => {
    jest.spyOn(authGuardProto, 'canActivate').mockResolvedValue(true);
    const redis = createRedisMock();
    redis.isJwtBlacklisted.mockResolvedValue(true);
    const guard = makeGuard(false, redis);
    const ctx = createExecutionContext({ request: { user: { jti: 'j', sub: 's' } } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  describe('handleRequest', () => {
    it('retorna el usuario cuando la validación fue exitosa', () => {
      const guard = makeGuard(false, createRedisMock());
      const ctx = createExecutionContext({});
      const user = { sub: 's', role: 'PARENT' };
      expect(guard.handleRequest(null, user, null, ctx)).toBe(user);
    });

    it('lanza si hay error o no hay usuario', () => {
      const guard = makeGuard(false, createRedisMock());
      const ctx = createExecutionContext({ request: { url: '/api/x', ip: '1.1.1.1' } });

      expect(() => guard.handleRequest(null, false, null, ctx)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(new Error('x'), false, null, ctx)).toThrow('x');
    });
  });
});
