// ============================================================================
// CONFIG E2E — app COMPLETA contra una PostgreSQL REAL (activa)
// ============================================================================
// Los tests e2e (`tests/e2e/**/*.e2e-spec.ts`) levantan la app con PrismaService
// real contra un Postgres verdadero (en CI, el servicio `postgres:15` con
// migraciones aplicadas por `prisma migrate deploy`). Mail y Redis se mockean.
// Ver `tests/e2e/README.md` (incluye la nota de RLS FORCE + corrida local opcional).
// ============================================================================

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@auth/(.*)$': '<rootDir>/../src/auth/$1',
    '^@users/(.*)$': '<rootDir>/../src/users/$1',
    '^@common/(.*)$': '<rootDir>/../src/common/$1',
    '^@prisma-service/(.*)$': '<rootDir>/../src/prisma/$1',
  },
  setupFiles: ['<rootDir>/setup/env.ts'],
  // e2e NO usa cobertura del gate; valida el sistema real de extremo a extremo.
  testTimeout: 30000,
  // Serial: comparten la misma BD; evita contención y flakiness entre specs.
  maxWorkers: 1,
};
