// ============================================================================
// Integration · Notifications — polling in-app (cualquier rol autenticado)
// ============================================================================

import request from 'supertest';
import { UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';

describe('Notifications (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('401 sin token', async () => {
    expect((await http().get('/api/notifications')).status).toBe(401);
  });

  it('GET /api/notifications lista las propias', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }] as any);
    const res = await http().get('/api/notifications').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/notifications/unread-count devuelve el conteo', async () => {
    ctx.prisma.notification.count.mockResolvedValue(4);
    const res = await http()
      .get('/api/notifications/unread-count')
      .set('Authorization', authAs(UserRole.SPECIALIST));
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(4);
  });

  it('PATCH /api/notifications/read-all marca todas', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.notification.updateMany.mockResolvedValue({ count: 3 } as any);
    const res = await http()
      .patch('/api/notifications/read-all')
      .set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(3);
  });

  it('PATCH /api/notifications/:id/read → 404 si no es propia', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.notification.updateMany.mockResolvedValue({ count: 0 } as any);
    const res = await http()
      .patch('/api/notifications/n1/read')
      .set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(404);
  });
});
