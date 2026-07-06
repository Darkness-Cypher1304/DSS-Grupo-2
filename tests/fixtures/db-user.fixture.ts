// ============================================================================
// Fixture de un registro `User` de Prisma (para mocks de la capa de datos)
// ============================================================================

import { User, UserRole, UserStatus } from '@prisma/client';

import { USER_IDS, USER_EMAILS } from './users.fixture';

/** Construye un `User` completo (valores por defecto sensatos, sobreescribibles). */
export function dbUser(overrides: Partial<User> = {}): User {
  const base = {
    id: USER_IDS.parent,
    email: USER_EMAILS.parent,
    passwordHash: '$2b$04$abcdefghijklmnopqrstuv', // placeholder; sobreescribir si se compara
    fullName: 'Padre de Prueba',
    phoneNumber: null,
    role: UserRole.PARENT,
    status: UserStatus.ACTIVE,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    deletedAt: null,
    deletionRequestedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
  return base as unknown as User;
}
