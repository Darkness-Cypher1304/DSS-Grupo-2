// ============================================================================
// E2E · M-CHAT — submit con scoring en el SERVIDOR y aislamiento por usuario,
// contra la BD real (ejercita runWithUserContext + transacción + FK real).
// ============================================================================
// NOTA RLS: el submit corre dentro de runWithUserContext (SET LOCAL). En CI la
// app conecta como superusuario → RLS FORCE queda bypasseado; el aislamiento que
// se valida aquí es el de la CAPA DE APP (getOne ajeno → 404). El bloqueo RLS a
// nivel de BD se verifica en Render (dueño no-superusuario). Ver README.md.
// ============================================================================

import request from 'supertest';

import { buildE2EApp, E2EApp } from './helpers/e2e-app';
import { registerVerifyLogin } from './helpers/e2e-auth';
import { expectedAnswers, failAnswers, CRITICAL_IDS } from '../fixtures/mchat.fixture';

describe('M-CHAT (e2e)', () => {
  let ctx: E2EApp;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await buildE2EApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/mchat/questions es público y trae las 20 preguntas', async () => {
    const res = await request(server()).get('/api/mchat/questions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
  });

  it('submit con todas correctas → 201, riesgo LOW calculado en el servidor', async () => {
    const parent = await registerVerifyLogin(ctx.app, ctx.prisma);
    const res = await request(server())
      .post('/api/mchat')
      .set('Authorization', parent.auth)
      .send({ childAgeMonths: 24, responses: expectedAnswers() });

    expect(res.status).toBe(201);
    expect(res.body.data.totalScore).toBe(0);
    expect(res.body.data.riskLevel).toBe('LOW');
    expect(res.body.data.id).toBeTruthy();
  });

  it('submit fallando los ítems críticos → riesgo HIGH (criticalFailures ≥ 2)', async () => {
    const parent = await registerVerifyLogin(ctx.app, ctx.prisma);
    const res = await request(server())
      .post('/api/mchat')
      .set('Authorization', parent.auth)
      .send({ childAgeMonths: 30, responses: failAnswers(CRITICAL_IDS) });

    expect(res.status).toBe(201);
    expect(res.body.data.riskLevel).toBe('HIGH');
  });

  it('submit con respuestas incompletas → 400', async () => {
    const parent = await registerVerifyLogin(ctx.app, ctx.prisma);
    const res = await request(server())
      .post('/api/mchat')
      .set('Authorization', parent.auth)
      .send({ childAgeMonths: 24, responses: { q1: 'YES' } });
    expect(res.status).toBe(400);
  });

  it('history propio + getOne propio → 200', async () => {
    const parent = await registerVerifyLogin(ctx.app, ctx.prisma);
    const submit = await request(server())
      .post('/api/mchat')
      .set('Authorization', parent.auth)
      .send({ childAgeMonths: 24, responses: expectedAnswers() });
    const id = submit.body.data.id as string;

    const history = await request(server())
      .get('/api/mchat/history')
      .set('Authorization', parent.auth);
    expect(history.status).toBe(200);
    expect(history.body.data.length).toBeGreaterThanOrEqual(1);

    const one = await request(server())
      .get(`/api/mchat/${id}`)
      .set('Authorization', parent.auth);
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe(id);
  });

  it('getOne de una evaluación AJENA → 404 (IDOR cerrado en capa de app)', async () => {
    const a = await registerVerifyLogin(ctx.app, ctx.prisma);
    const b = await registerVerifyLogin(ctx.app, ctx.prisma);

    const bSubmit = await request(server())
      .post('/api/mchat')
      .set('Authorization', b.auth)
      .send({ childAgeMonths: 24, responses: expectedAnswers() });
    const bId = bSubmit.body.data.id as string;

    const res = await request(server())
      .get(`/api/mchat/${bId}`)
      .set('Authorization', a.auth);
    expect(res.status).toBe(404);
  });
});
