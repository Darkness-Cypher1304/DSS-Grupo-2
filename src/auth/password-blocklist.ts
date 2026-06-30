// ============================================================================
// Blocklist de contraseñas comunes / triviales
// ============================================================================
// Cumple el control prometido en auth.dto.ts ("prohibimos las contraseñas más
// comunes") y la recomendación NIST SP 800-63B (2017+): rechazar contraseñas
// conocidas/débiles en lugar de exigir reglas de complejidad arbitrarias.
// Sin dependencias externas: lista curada + detección de patrones de baja
// entropía. Se aplica SIEMPRE del lado del servidor (registro, reset, cambio).
// ============================================================================

// Lista en minúsculas. Incluye variantes "largas" (>=12 chars) porque la
// política exige mínimo 12 y las débiles reales suelen ser relleno trivial.
const COMMON_PASSWORDS = new Set<string>([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789012345',
  '0123456789012',
  'password1234',
  'password12345',
  'password123456',
  'passwordpassword',
  'mypassword123',
  'contrasena123',
  'contrasena1234',
  'qwertyuiop12',
  'qwerty1234567',
  'qwertyqwerty',
  '1q2w3e4r5t6y',
  'abcdefghijkl',
  'abcabcabcabc',
  'iloveyou1234',
  'welcome123456',
  'admin1234567',
  'administrador1',
  'letmein123456',
  'neuroalert12',
  'neuroalert123',
  'neuroalert2026',
]);

// Palabras "base" comunes: si la contraseña es una de estas seguida solo de
// dígitos (p.ej. "Password1234", "neuroalert2026"), se considera débil.
const COMMON_BASES = new Set<string>([
  'password',
  'passwords',
  'contrasena',
  'contraseña',
  'qwerty',
  'qwertyuiop',
  'neuroalert',
  'iloveyou',
  'welcome',
  'admin',
  'administrador',
  'letmein',
  'usuario',
  'login',
  'abcdef',
  'abcabc',
]);

/**
 * Devuelve `true` si la contraseña es trivialmente débil:
 *   - está en la blocklist curada, o
 *   - es un único carácter repetido (p.ej. "aaaaaaaaaaaa"), o
 *   - es una secuencia ascendente/descendente simple de dígitos.
 * Comparación case-insensitive sobre la cadena recortada.
 */
export function isCommonPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase();

  if (COMMON_PASSWORDS.has(normalized)) return true;

  // Un solo carácter repetido → entropía casi nula.
  if (/^(.)\1+$/.test(normalized)) return true;

  // Secuencia ascendente o descendente de dígitos (p.ej. "012345678901").
  if (/^\d+$/.test(normalized)) {
    const asc = '01234567890123456789';
    const desc = '98765432109876543210';
    if (asc.includes(normalized) || desc.includes(normalized)) return true;
  }

  // Palabra base común + sufijo trivial de dígitos (tras quitar símbolos).
  // Atrapa "Password1234", "neuroalert2026", "qwerty123456", etc.
  const alnum = normalized.replace(/[^a-z0-9ñ]/g, '');
  const base = alnum.replace(/[0-9]+$/, '');
  if (COMMON_BASES.has(base)) return true;

  return false;
}
