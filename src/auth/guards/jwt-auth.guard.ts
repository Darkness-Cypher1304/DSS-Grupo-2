// ============================================================================
// JwtAuthGuard
// ============================================================================
// Guard global que se aplica a TODOS los endpoints (Complete Mediation).
// Valida el JWT en cada request y consulta la blacklist de Redis.
//
// Para hacer un endpoint público se usa @Public() — Fail-Safe Defaults:
// si olvidas marcarlo como público, queda protegido por defecto.
// ============================================================================

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_KEY, AuthUser } from '../../common/decorators';
import { RedisService } from '../../config/redis.module';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ----------------------------------------------------------------------
    // 1) ¿Endpoint público? → permitir sin validar
    // ----------------------------------------------------------------------
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ----------------------------------------------------------------------
    // 2) Validación de firma + expiración (Passport)
    // ----------------------------------------------------------------------
    const result = (await super.canActivate(context)) as boolean;
    if (!result) return false;

    // ----------------------------------------------------------------------
    // 3) Verificación de blacklist en Redis
    // ----------------------------------------------------------------------
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (user?.jti) {
      const isBlacklisted = await this.redis.isJwtBlacklisted(user.jti);
      if (isBlacklisted) {
        this.logger.warn({ userId: user.sub, jti: user.jti }, 'JWT en blacklist');
        throw new UnauthorizedException('Token revocado');
      }
    }

    return true;
  }

  // ----------------------------------------------------------------------
  // handleRequest síncrono — solo maneja errores, sin lógica async.
  // ----------------------------------------------------------------------
  override handleRequest<TUser = AuthUser>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      this.logger.warn({ url: request.url, ip: request.ip }, 'JWT inválido o ausente');
      throw err || new UnauthorizedException('No autenticado');
    }
    return user as TUser;
  }
}
