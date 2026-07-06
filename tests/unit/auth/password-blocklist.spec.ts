// ============================================================================
// Unit · password-blocklist (NIST SP 800-63B — rechazo de contraseñas débiles)
// ============================================================================

import { isCommonPassword } from '../../../src/auth/password-blocklist';

describe('isCommonPassword', () => {
  it('rechaza contraseñas de la blocklist curada', () => {
    expect(isCommonPassword('password1234')).toBe(true);
    expect(isCommonPassword('neuroalert2026')).toBe(true);
  });

  it('rechaza (case-insensitive y con espacios) las de la blocklist', () => {
    expect(isCommonPassword('  Password1234  ')).toBe(true);
  });

  it('rechaza un único carácter repetido (entropía casi nula)', () => {
    expect(isCommonPassword('aaaaaaaaaaaa')).toBe(true);
  });

  it('rechaza secuencias ascendentes/descendentes de dígitos', () => {
    expect(isCommonPassword('012345678901')).toBe(true);
    expect(isCommonPassword('987654321098')).toBe(true);
  });

  it('rechaza palabra base común + sufijo trivial de dígitos', () => {
    expect(isCommonPassword('qwerty123456')).toBe(true);
    expect(isCommonPassword('administrador1')).toBe(true);
  });

  it('acepta una contraseña fuerte y no trivial', () => {
    expect(isCommonPassword('Tr#9x!Lm2$Qz')).toBe(false);
    expect(isCommonPassword('correcto-caballo-bateria-grapa')).toBe(false);
  });

  it('acepta dígitos que no forman una secuencia simple', () => {
    expect(isCommonPassword('194837261509')).toBe(false);
  });
});
