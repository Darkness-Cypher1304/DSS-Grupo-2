// ============================================================================
// Integration · Audit — visor solo ADMIN (@Roles) + RLS
// ============================================================================

import request from 'supertest';
import { UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';

describe('Audit (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/audit → 403 si no es ADMIN', async () => {
    const res = await http().get('/api/audit').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(403);
  });

  it('GET /api/audit → 200 para ADMIN (paginado)', async () => {
    ctx.prisma.auditLog.findMany.mockResolvedValue([]);
    ctx.prisma.auditLog.count.mockResolvedValue(0);
    const res = await http().get('/api/audit').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 0, page: 1 });
  });

  it('GET /api/audit/stats → 200 para ADMIN', async () => {
    ctx.prisma.auditLog.count.mockResolvedValue(0);
     
    (ctx.prisma.auditLog.groupBy as unknown as jest.Mock).mockResolvedValue([]);
    const res = await http().get('/api/audit/stats').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('successRate');
  });
});
