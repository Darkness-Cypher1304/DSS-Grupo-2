// ============================================================================
// Decoradores comunes
// ============================================================================
// @Public()       — marca un endpoint como público (sin JWT)
// @Roles(...)     — restringe a roles específicos
// @CurrentUser()  — inyecta el usuario autenticado en el handler
// ============================================================================

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

import { UserRole } from '@prisma/client';

// ----------------------------------------------------------------------------
// @Public()
// Por defecto TODOS los endpoints requieren JWT (Complete Mediation).
// Con @Public() marcamos los pocos que son verdaderamente públicos.
// ----------------------------------------------------------------------------
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

// ----------------------------------------------------------------------------
// @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
// RBAC declarativo. RolesGuard lee este metadata.
// ----------------------------------------------------------------------------
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

// ----------------------------------------------------------------------------
// @CurrentUser() — extrae el JWT payload validado
// ----------------------------------------------------------------------------
export interface AuthUser {
  sub: string;     // userId (CUID)
  email: string;
  role: UserRole;
  jti: string;     // token id, para revocación
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) return undefined;
    return data ? user[data] : user;
  },
);

// ----------------------------------------------------------------------------
// @ClientIp() — extrae la IP real del cliente respetando X-Forwarded-For
// ----------------------------------------------------------------------------
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  // Express con trust proxy ya parsea X-Forwarded-For correctamente
  return (
    request.ip ||
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    request.socket.remoteAddress ||
    'unknown'
  );
});
