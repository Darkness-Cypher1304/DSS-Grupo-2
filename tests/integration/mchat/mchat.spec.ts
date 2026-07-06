// ============================================================================
// Integration · M-CHAT — público vs @Roles(PARENT), scoring server-side, IDOR
// ============================================================================

import request from 'supertest';
import { UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';
import { expectedAnswers } from '../../fixtures/mchat.fixture';

describe('M-CHAT (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/mchat/questions es público y no filtra las respuestas esperadas', async () => {
    const res = await http().get('/api/mchat/questions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.data[0]).not.toHaveProperty('expectedAnswer');
  });

  it('POST /api/mchat → 403 si el rol no es PARENT', async () => {
    const res = await http()
      .post('/api/mchat')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .send({ childAgeMonths: 24, responses: expectedAnswers() });
    expect(res.status).toBe(403);
  });

  it('POST /api/mchat → 201 con PARENT y calcula el riesgo en el servidor', async () => {
    ctx.prisma.mchatScreening.create.mockResolvedValue({
      id: 's1',
      childAgeMonths: 24,
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await http()
      .post('/api/mchat')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ childAgeMonths: 24, responses: expectedAnswers() });

    expect(res.status).toBe(201);
    expect(res.body.data.riskLevel).toBe('LOW');
  });

  it('POST /api/mchat → 400 si las respuestas no son las 20 esperadas', async () => {
    const res = await http()
      .post('/api/mchat')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ childAgeMonths: 24, responses: { q1: 'YES' } });
    expect(res.status).toBe(400);
  });

  it('GET /api/mchat/:id → 404 si la evaluación no existe (IDOR devuelve 404)', async () => {
    ctx.prisma.mchatScreening.findUnique.mockResolvedValue(null);
    const res = await http().get('/api/mchat/xxx').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(404);
  });
});
