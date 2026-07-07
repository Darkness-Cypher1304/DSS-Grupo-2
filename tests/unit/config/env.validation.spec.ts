// ============================================================================
// Unit · validateEnv — fail-fast de variables de entorno críticas (H8)
// ============================================================================

import { validateEnv } from '../../../src/config/env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db?schema=public',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('acepta una config con las 3 variables críticas presentes', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('devuelve el config COMPLETO (preserva variables desconocidas)', () => {
    const cfg = { ...base, PORT: '4000', BREVO_API_KEY: 'x', ALGO_RARO: 'ok' };
    expect(validateEnv(cfg)).toEqual(cfg);
  });

  it('lanza si falta una variable crítica (DATABASE_URL)', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/Configuración de entorno inválida/);
  });

  it('lanza si un secreto JWT está vacío', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: '' })).toThrow(
      /Configuración de entorno inválida/,
    );
  });
});
