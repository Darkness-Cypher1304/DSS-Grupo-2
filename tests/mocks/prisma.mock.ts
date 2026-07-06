// ============================================================================
// Mock de PrismaService (jest-mock-extended → DeepMockProxy)
// ============================================================================
// Aísla la capa de datos: ninguna prueba unit/integration toca PostgreSQL.
// Es el equivalente en el backend de lo que MSW hace en el frontend (mockear
// la frontera). El e2e (reservado) es el que usa una DB real.
// ============================================================================

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

import { PrismaService } from '../../src/prisma/prisma.service';

export type PrismaMock = DeepMockProxy<PrismaService>;

/**
 * Crea un mock profundo de PrismaService con dos comportamientos por defecto:
 *   - `runWithUserContext(uid, role, fn)` ejecuta `fn` pasándole el propio mock
 *     como "tx" (así los tests configuran `prisma.modelo.metodo` normalmente).
 *   - `$transaction(fn)` ejecuta el callback con el mock; si recibe un array,
 *     resuelve todas las promesas.
 */
export function createPrismaMock(): PrismaMock {
  const mock = mockDeep<PrismaService>();

  mock.runWithUserContext.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((_userId: string, _role: string, fn: (tx: any) => any) => fn(mock)) as any,
  );

  mock.$transaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(mock))) as any,
  );

  return mock;
}

/** Reinicia el mock (útil en `beforeEach` si se comparte una instancia). */
export function resetPrismaMock(mock: PrismaMock): void {
  mockReset(mock);
  mock.runWithUserContext.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((_userId: string, _role: string, fn: (tx: any) => any) => fn(mock)) as any,
  );
  mock.$transaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(mock))) as any,
  );
}
