// ============================================================================
// E2E · Health — la app real contra una PostgreSQL real.
// ============================================================================
// A diferencia de la integración (Prisma mockeado), aquí `checks.database`
// prueba la conectividad REAL a la BD a través de la app (SELECT 1). Es la
// señal de que migraciones + conexión + arranque funcionan de extremo a extremo.
// ============================================================================

import request from 'supertest';

import { buildE2EApp, E2EApp } from './helpers/e2e-app';

describe('Health (e2e)', () => {
  let ctx: E2EApp;
  beforeAll(async () => {
    ctx = await buildE2EApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health → 200 y confirma la conexión REAL a la BD', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    // Envoltorio { data, meta } del TransformInterceptor global.
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.checks.database).toBe(true); // ← conectó a Postgres de verdad
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/health → 404 (health queda fuera del prefijo /api)', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(404);
  });
});
