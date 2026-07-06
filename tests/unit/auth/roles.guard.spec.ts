// ============================================================================
// Unit · RolesGuard (RBAC) — control de acceso por rol
// ============================================================================

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { createExecutionContext } from '../../mocks/execution-context.mock';
import { adminUser, parentUser } from '../../fixtures/users.fixture';

function guardWithRoles(roles: UserRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('permite si el endpoint no declara @Roles()', () => {
    const guard = guardWithRoles(undefined);
    const ctx = createExecutionContext({ request: { user: parentUser() } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite si la lista de roles está vacía', () => {
    const guard = guardWithRoles([]);
    const ctx = createExecutionContext({ request: { user: parentUser() } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite si el rol del usuario está autorizado', () => {
    const guard = guardWithRoles([UserRole.ADMIN]);
    const ctx = createExecutionContext({ request: { user: adminUser() } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega (403) si el rol del usuario no está autorizado', () => {
    const guard = guardWithRoles([UserRole.ADMIN]);
    const ctx = createExecutionContext({ request: { user: parentUser() } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('deniega (403) si no hay usuario en el request', () => {
    const guard = guardWithRoles([UserRole.ADMIN]);
    const ctx = createExecutionContext({ request: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
