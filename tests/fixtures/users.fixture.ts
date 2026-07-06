// ============================================================================
// Fixtures de usuarios / payloads JWT por rol
// ============================================================================

import { UserRole } from '@prisma/client';

import type { AuthUser } from '../../src/common/decorators';

/** IDs estables (formato CUID-like) para cada rol de prueba. */
export const USER_IDS = {
  parent: 'clparent00000000000000000',
  specialist: 'clspecialist000000000000',
  admin: 'cladmin0000000000000000000',
} as const;

export const USER_EMAILS = {
  parent: 'padre@test.pe',
  specialist: 'especialista@test.pe',
  admin: 'admin@test.pe',
} as const;

/** Construye un payload JWT (AuthUser) válido para el rol dado. */
export function authUser(role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser {
  const key = role === UserRole.ADMIN ? 'admin' : role === UserRole.SPECIALIST ? 'specialist' : 'parent';
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: USER_IDS[key],
    email: USER_EMAILS[key],
    role,
    jti: `jti-${key}-0001`,
    iat: now,
    exp: now + 900,
    ...overrides,
  };
}

export const parentUser = (o: Partial<AuthUser> = {}): AuthUser => authUser(UserRole.PARENT, o);
export const specialistUser = (o: Partial<AuthUser> = {}): AuthUser => authUser(UserRole.SPECIALIST, o);
export const adminUser = (o: Partial<AuthUser> = {}): AuthUser => authUser(UserRole.ADMIN, o);
