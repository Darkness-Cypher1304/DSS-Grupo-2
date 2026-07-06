// ============================================================================
// ESLint SECURITY (flat config) — SAST de patrones inseguros con
// eslint-plugin-security. SEPARADA de `eslint.config.js` (calidad) a propósito:
// distinta responsabilidad (análisis de seguridad, no de estilo/calidad), por lo
// que se ejecuta en el job de seguridad del pipeline, no en Code Quality & Build.
// ----------------------------------------------------------------------------
// Recomendación del curso: iniciar el SAST con eslint-plugin-security (feedback
// inmediato) y complementarlo con CodeQL (análisis semántico). Ambos COEXISTEN
// en jobs distintos del pipeline; no compiten ni se pisan.
//
// Este gate es BLOQUEANTE: se ejecuta con `--max-warnings 0`, de modo que
// cualquier hallazgo de una regla activa detiene el pipeline.
// ============================================================================

const security = require('eslint-plugin-security');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'tests/reports/**'],
  },
  // Reglas recomendadas del plugin (activan todas las security/detect-*).
  security.configs.recommended,
  {
    // Solo el código de producción (src). Los tests no van a producción.
    files: ['src/**/*.ts'],
    languageOptions: {
      // Parser TS SIN `project`: las reglas de seguridad trabajan sobre el AST y
      // no requieren información de tipos → más rápido y sin depender de `prisma generate`.
      parser: tsParser,
      parserOptions: { sourceType: 'module' },
    },
    rules: {
      // ----------------------------------------------------------------------
      // detect-object-injection → DESACTIVADA (a nivel de proyecto).
      // Motivo: es la regla con mayor tasa de FALSOS POSITIVOS del plugin;
      // dispara en TODO acceso por corchetes con variable (`obj[key]`), aun
      // cuando la clave es de tipo `keyof T` (acceso type-safe) o un índice
      // numérico de iteración. En este backend los 6 hits eran FP legítimos
      // (p. ej. `user[data]` con `data: keyof AuthUser`, `buffer[i]` en un
      // `.every`, `MAGIC_BYTES[mime]` sobre un mapa constante con mime validado).
      // La protección REAL contra inyección de propiedades ya la dan: (a) el
      // sistema de tipos de TypeScript, (b) el `ValidationPipe` global
      // (`whitelist` + `forbidNonWhitelisted`, anti mass-assignment) y (c) el
      // análisis semántico de CodeQL. Mantenerla bloqueante rompería el pipeline
      // por ruido, sin ganancia de seguridad.
      // ⏳ A FUTURO: reevaluar si conviene reactivarla con overrides puntuales.
      'security/detect-object-injection': 'off',
    },
  },
  {
    // ----------------------------------------------------------------------
    // detect-unsafe-regex → se mantiene ACTIVA para el resto de `src/` (detecta
    // ReDoS real en futuros regex). Excepción SCOPEADA a este archivo: el regex
    // de `linkedinUrl` (`([\w-]+\.)+[\w-]+`) lo marca la heurística por el
    // cuantificador anidado, pero se MIDIÓ empíricamente y es SEGURO: con
    // entradas maliciosas de hasta 20.000 caracteres corre en < 0,25 ms y de
    // forma LINEAL (el `.` obligatorio entre repeticiones impide el backtracking
    // catastrófico). Es un falso positivo probado. Se desactiva solo aquí para
    // no perder la regla en el resto del código.
    // ⏳ A FUTURO: si el regex cambia, reevaluar esta excepción.
    files: ['src/applications/dto/applications.dto.ts'],
    rules: {
      'security/detect-unsafe-regex': 'off',
    },
  },
];
