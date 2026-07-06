// ============================================================================
// Configuración de Jest (extraída del package.json)
// ============================================================================
// Arquitectura de tests: carpeta `tests/` HERMANA de `src/` (no anidada).
//   - tests/unit/**        → unidades aisladas (Prisma/Mail/Redis mockeados)
//   - tests/integration/** → controller+service+guards+pipes vía @nestjs/testing
//                            + supertest, con Prisma MOCKEADO (sin DB real)
//   - tests/e2e/**         → RESERVADO (app + postgres real); NO lo corre Jest aquí
//
// La selección unit vs integration es por RUTA (scripts test:unit / test:integration);
// ambos usan el sufijo `*.spec.ts`. El Coverage Gate corre la suite COMBINADA.
// ============================================================================

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Solo unit e integration. e2e queda fuera (DB real, se corre aparte).
  testMatch: [
    '<rootDir>/tests/unit/**/*.spec.ts',
    '<rootDir>/tests/integration/**/*.spec.ts',
  ],

  // ts-jest con el tsconfig de tests (incluye src + tests → sin warnings).
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  // Alias de `paths` del tsconfig (por si algún test los usa).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@users/(.*)$': '<rootDir>/src/users/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@prisma-service/(.*)$': '<rootDir>/src/prisma/$1',
  },

  // env de test (JWT secrets, DATABASE_URL dummy) ANTES de cargar módulos.
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  // hooks globales (reset de mocks entre tests).
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

  // --------------------------------------------------------------------------
  // COBERTURA — superficie con COMPORTAMIENTO. Exclusiones justificadas:
  //   - *.module.ts : cableado DI puro (la lógica de Redis vive en redis.service.ts).
  //   - main.ts     : bootstrap.
  //   - *.d.ts      : solo tipos.
  // NO se excluyen: dtos con @Transform (los ejercita integración), decorators
  // (ClientIp/CurrentUser tienen lógica), mchat-questions (scoring) ni redis.service.
  // Prohibido excluir algo solo para inflar el porcentaje.
  // --------------------------------------------------------------------------
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/tests/reports/coverage',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'json', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },

  clearMocks: true,
  verbose: false,
};
