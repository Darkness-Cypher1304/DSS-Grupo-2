// ============================================================================
// Variables de entorno para el entorno de test (se cargan ANTES de los módulos)
// ============================================================================
// NestJS exige JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (>=32 chars) y DATABASE_URL
// para inicializar. En unit/integration Prisma está MOCKEADO, así que la URL es
// dummy (nunca se conecta). Estos valores son de PRUEBA, no secretos reales.
// ============================================================================

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test_access_secret_minimo_32_chars_aaaaaaaaaaaa';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test_refresh_secret_minimo_32_chars_bbbbbbbbbbbb';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test_db?schema=public';
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? 'neuroalert';
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'neuroalert-users';
process.env.JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION ?? '15m';
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4'; // rounds bajos = tests rápidos
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
