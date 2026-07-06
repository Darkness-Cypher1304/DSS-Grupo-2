// ============================================================================
// Integration · Content — público vs @Roles(SPECIALIST/ADMIN), flujo editorial
// ============================================================================

import request from 'supertest';
import { ContentStatus, UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';
import { USER_IDS } from '../../fixtures/users.fixture';

const validArticle = {
  title: 'Señales tempranas del TEA a los 18 meses',
  summary: 'Un resumen educativo sobre las señales tempranas a observar.',
  body: 'Cuerpo del artículo con más de cincuenta caracteres para pasar la validación mínima.',
  category: 'Señales tempranas',
  tags: ['tea', 'señales'],
};

describe('Content (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/content es público (lista publicados)', async () => {
    ctx.prisma.content.findMany.mockResolvedValue([]);
    ctx.prisma.content.count.mockResolvedValue(0);
    const res = await http().get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('GET /api/content/by-slug/:slug → 404 si no está publicado', async () => {
    ctx.prisma.content.findUnique.mockResolvedValue(null);
    const res = await http().get('/api/content/by-slug/inexistente');
    expect(res.status).toBe(404);
  });

  it('GET /api/content/by-slug/:slug → 200 si está publicado', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.findUnique.mockResolvedValue({ id: 'c1', status: ContentStatus.PUBLISHED } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.update.mockResolvedValue({} as any);
    const res = await http().get('/api/content/by-slug/guia');
    expect(res.status).toBe(200);
  });

  it('GET /api/content/mine → 200 para SPECIALIST', async () => {
    ctx.prisma.content.findMany.mockResolvedValue([]);
    const res = await http().get('/api/content/mine').set('Authorization', authAs(UserRole.SPECIALIST));
    expect(res.status).toBe(200);
  });

  it('POST /api/content → 403 si es PARENT', async () => {
    const res = await http()
      .post('/api/content')
      .set('Authorization', authAs(UserRole.PARENT))
      .send(validArticle);
    expect(res.status).toBe(403);
  });

  it('POST /api/content → 201 si es SPECIALIST (DRAFT)', async () => {
    ctx.prisma.content.findUnique.mockResolvedValue(null); // slug libre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.create.mockResolvedValue({ id: 'c1' } as any);
    const res = await http()
      .post('/api/content')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .send(validArticle);
    expect(res.status).toBe(201);
  });

  it('PATCH /api/content/:id (SPECIALIST autor) actualiza', async () => {
    ctx.prisma.content.findUnique.mockResolvedValue({
      id: 'c1',
      authorId: USER_IDS.specialist,
      status: ContentStatus.DRAFT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.update.mockResolvedValue({} as any);
    const res = await http()
      .patch('/api/content/c1')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .send({ title: 'Título actualizado del artículo' });
    expect(res.status).toBe(200);
  });

  it('POST /api/content/:id/submit (SPECIALIST autor) → PENDING', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: USER_IDS.specialist } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.update.mockResolvedValue({} as any);
    const res = await http().post('/api/content/c1/submit').set('Authorization', authAs(UserRole.SPECIALIST));
    expect(res.status).toBe(201);
  });

  it('GET /api/content/admin/pending (ADMIN)', async () => {
    ctx.prisma.content.findMany.mockResolvedValue([]);
    const res = await http().get('/api/content/admin/pending').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
  });

  it('DELETE /api/content/:id (ADMIN) soft-delete', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.update.mockResolvedValue({} as any);
    const res = await http().delete('/api/content/c1').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
  });

  it('PATCH /api/content/admin/:id/status publica (ADMIN)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.content.update.mockResolvedValue({ id: 'c1' } as any);
    const res = await http()
      .patch('/api/content/admin/c1/status')
      .set('Authorization', authAs(UserRole.ADMIN))
      .send({ status: ContentStatus.PUBLISHED });
    expect(res.status).toBe(200);
  });
});
