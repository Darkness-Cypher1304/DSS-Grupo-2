// ============================================================================
// Integration · Health
// ============================================================================
// Valida que la app completa arranca, que /health es público (sin JWT) y queda
// FUERA del prefijo /api, y que reporta el estado de DB/cache. También confirma
// el envoltorio { data, meta } del TransformInterceptor global.
// ============================================================================

import request from 'supertest';

import { buildApp, resetAppMocks, TestApp } from '../../helpers/integration';

describe('Health (integration)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildApp();
  });

  afterEach(() => resetAppMocks(ctx));

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health responde 200, es público y va fuera de /api', async () => {
    ctx.redis.ping.mockResolvedValue(true);

    const res = await request(ctx.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    // Envoltorio estándar { data, meta } del TransformInterceptor
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.data).toHaveProperty('checks');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.checks.cache).toBe(true);
  });

  it('reporta "degraded" si el cache no responde', async () => {
    ctx.redis.ping.mockResolvedValue(false);

    const res = await request(ctx.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.checks.cache).toBe(false);
  });

  it('no expone /api/health (el prefijo excluye health)', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(404);
  });
});
