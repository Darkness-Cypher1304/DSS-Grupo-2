// ============================================================================
// Integration · Questions — RBAC PARENT/SPECIALIST y validación
// ============================================================================

import request from 'supertest';
import { UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';

describe('Questions (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('POST /api/questions → 403 si el rol no es PARENT', async () => {
    const res = await http()
      .post('/api/questions')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .send({ title: '¿Cómo evalúo a mi hijo?', body: 'Tiene 24 meses y no señala objetos aún.' });
    expect(res.status).toBe(403);
  });

  it('POST /api/questions → 201 con PARENT', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.question.create.mockResolvedValue({ id: 'q1' } as any);
    const res = await http()
      .post('/api/questions')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ title: '¿Cómo evalúo a mi hijo?', body: 'Tiene 24 meses y no señala objetos aún.' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'q1' });
  });

  it('POST /api/questions → 400 si el título es muy corto', async () => {
    const res = await http()
      .post('/api/questions')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ title: 'corto', body: 'Tiene 24 meses y no señala objetos aún.' });
    expect(res.status).toBe(400);
  });

  it('GET /api/questions lista (filtrado por RLS/rol)', async () => {
    ctx.prisma.question.findMany.mockResolvedValue([]);
    const res = await http().get('/api/questions').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(200);
  });

  it('POST /api/questions/:id/answer → 403 si es PARENT (solo SPECIALIST)', async () => {
    const res = await http()
      .post('/api/questions/q1/answer')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ body: 'Una respuesta suficientemente larga para pasar validación.' });
    expect(res.status).toBe(403);
  });
});
