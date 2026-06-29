// ============================================================================
// JwtStrategy
// ============================================================================
// Estrategia de Passport que valida el JWT de cada request.
// El token viaja en header: Authorization: Bearer <token>
// ============================================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { AuthUser } from '../../common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET no está configurado');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: config.get<string>('JWT_ISSUER', 'neuroalert'),
      audience: config.get<string>('JWT_AUDIENCE', 'neuroalert-users'),
      passReqToCallback: false,
    });
  }

  /**
   * `validate` se ejecuta automáticamente cuando el JWT es válido.
   * El valor retornado se inyecta en `request.user`.
   */
  validate(payload: AuthUser): AuthUser {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Token mal formado');
    }
    return payload;
  }
}
