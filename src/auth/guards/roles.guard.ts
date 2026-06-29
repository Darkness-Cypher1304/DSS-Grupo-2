// ============================================================================
// RolesGuard — RBAC (Role-Based Access Control)
// ============================================================================
// Lee el metadata @Roles(...) y compara contra el rol del usuario en JWT.
// Se ejecuta DESPUÉS de JwtAuthGuard (orden de APP_GUARDs en AppModule).
// ============================================================================

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ROLES_KEY, AuthUser } from '../../common/decorators';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay @Roles() declarado, no aplica restricción de roles
    // (pero el JwtAuthGuard ya validó autenticación si no es @Public)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Acceso denegado');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Acceso denegado. Rol requerido: ${requiredRoles.join(' o ')}`,
      );
    }

    return true;
  }
}
