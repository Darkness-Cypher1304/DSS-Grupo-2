// ============================================================================
// Integration · Users — perfil, endpoints admin (@Roles) y cron protegido
// ============================================================================

import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';
import { dbUser } from '../../fixtures/db-user.fixture';

describe('Users (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/users/me devuelve el perfil sin campos sensibles', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(dbUser({ id: 'u1', passwordHash: 'secreto' }));
    const res = await http().get('/api/users/me').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('GET /api/users/admin/all → 403 para PARENT, 200 para ADMIN', async () => {
    expect(
      (await http().get('/api/users/admin/all').set('Authorization', authAs(UserRole.PARENT))).status,
    ).toBe(403);

    ctx.prisma.user.findMany.mockResolvedValue([]);
    ctx.prisma.user.count.mockResolvedValue(0);
    const ok = await http().get('/api/users/admin/all').set('Authorization', authAs(UserRole.ADMIN));
    expect(ok.status).toBe(200);
    expect(ok.body.data.pagination).toBeDefined();
  });

  it('PATCH /api/users/admin/:id/status actualiza (ADMIN)', async () => {
    const res = await http()
      .patch('/api/users/admin/u2/status')
      .set('Authorization', authAs(UserRole.ADMIN))
      .send({ status: UserStatus.SUSPENDED });
    expect(res.status).toBe(200);
  });

  it('POST /api/users/me/request-deletion (PARENT, reautenticación)', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.PARENT, status: UserStatus.ACTIVE, passwordHash: await bcrypt.hash('Zx9!vQ2#mLw7', 4) }),
    );
    const res = await http()
      .post('/api/users/me/request-deletion')
      .set('Authorization', authAs(UserRole.PARENT))
      .send({ password: 'Zx9!vQ2#mLw7' });
    expect(res.status).toBe(201);
    expect(res.body.data.scheduledFor).toBeDefined();
  });

  it('POST /api/users/system/process-deletions → 401 sin x-cron-secret válido', async () => {
    const res = await http().post('/api/users/system/process-deletions');
    expect(res.status).toBe(401);
  });

  it('POST /api/users/me/cancel-deletion (PARENT) reactiva la cuenta', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(dbUser({ status: UserStatus.PENDING_DELETION }));
    const res = await http()
      .post('/api/users/me/cancel-deletion')
      .set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(201);
  });

  it('POST /api/users/me/request-leave (SPECIALIST) crea la baja', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.user.findUnique.mockResolvedValue({ ...dbUser({ role: UserRole.SPECIALIST }), leaveRequest: null } as any);
    const res = await http()
      .post('/api/users/me/request-leave')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .send({ reason: 'Finalización de colaboración' });
    expect(res.status).toBe(201);
  });

  it('GET /api/users/admin/leave-requests (ADMIN)', async () => {
    ctx.prisma.specialistLeaveRequest.findMany.mockResolvedValue([]);
    const res = await http()
      .get('/api/users/admin/leave-requests')
      .set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
  });

  it('PATCH /api/users/admin/leave-requests/:id/approve (ADMIN)', async () => {
    ctx.prisma.specialistLeaveRequest.findUnique.mockResolvedValue({
      id: 'l1',
      userId: 'u1',
      status: 'PENDING',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const res = await http()
      .patch('/api/users/admin/leave-requests/l1/approve')
      .set('Authorization', authAs(UserRole.ADMIN))
      .send({ note: 'ok' });
    expect(res.status).toBe(200);
  });
});
