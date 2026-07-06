// ============================================================================
// ESLint (flat config) — requerido por ESLint 9 (reemplaza .eslintrc.json)
// ============================================================================
// ESLint 9 usa "flat config" por defecto; el antiguo .eslintrc.json quedó
// deprecado y no se cargaba (el CI del backend nunca corría lint). Esta config
// replica exactamente las reglas previas: @typescript-eslint/recommended + los
// ajustes del proyecto, aplicadas a `src/` y `tests/` con el tsconfig de tests.
// ============================================================================

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'tests/reports/**'],
  },
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.spec.json',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // `ignoreRestSiblings`: permite el patrón intencional de omitir campos
      // sensibles vía rest (`const { passwordHash, ...safe } = user; return safe;`)
      // en users.service.ts sin marcar los descartados como no usados.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
];
