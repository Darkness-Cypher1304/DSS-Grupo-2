// ============================================================================
// 🔒 CONFIG E2E — RESERVADA (no se ejecuta en el pipeline por ahora)
// ============================================================================
// Los tests e2e usan la app COMPLETA contra una base de datos PostgreSQL REAL
// (el CI ya levanta `postgres:15`) con migraciones aplicadas. Es el análogo de
// Playwright en el frontend. Ver `tests/e2e/README.md` para activarlo.
//
// Mientras no haya specs e2e, `test:e2e` corre con `--passWithNoTests` para no
// romper. Cuando se implementen, vivirán en `tests/e2e/**/*.e2e-spec.ts`.
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
};
