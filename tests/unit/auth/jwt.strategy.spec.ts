// ============================================================================
// Unit · JwtStrategy — validación del payload del JWT
// ============================================================================

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import type { AuthUser } from '../../../src/common/decorators';

function configMock(secret: string | undefined): ConfigService {
  return {
    get: (key: string, def?: unknown) => {
      if (key === 'JWT_ACCESS_SECRET') return secret;
      if (key === 'JWT_ISSUER') return 'neuroalert';
      if (key === 'JWT_AUDIENCE') return 'neuroalert-users';
      return def;
    },
  } as unknown as ConfigService;
}

const validPayload: AuthUser = {
  sub: 'cluser0000000000000000000',
  email: 'user@test.pe',
  role: UserRole.PARENT,
  jti: 'jti-1',
  iat: 0,
  exp: 0,
};

describe('JwtStrategy', () => {
  it('lanza al construirse si falta JWT_ACCESS_SECRET', () => {
    expect(() => new JwtStrategy(configMock(undefined))).toThrow('JWT_ACCESS_SECRET');
  });

  it('validate() retorna el payload cuando es válido', () => {
    const strategy = new JwtStrategy(configMock('x'.repeat(40)));
    expect(strategy.validate(validPayload)).toEqual(validPayload);
  });

  it('validate() lanza 401 si el payload está mal formado', () => {
    const strategy = new JwtStrategy(configMock('x'.repeat(40)));
    expect(() => strategy.validate({ ...validPayload, sub: '' })).toThrow(UnauthorizedException);
    expect(() => strategy.validate({ ...validPayload, email: '' } as AuthUser)).toThrow(
      UnauthorizedException,
    );
    expect(() => strategy.validate({ ...validPayload, role: undefined } as unknown as AuthUser)).toThrow(
      UnauthorizedException,
    );
  });
});
