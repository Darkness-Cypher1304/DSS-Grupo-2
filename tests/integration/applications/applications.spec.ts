// ============================================================================
// Integration · Applications — postulación pública y revisión admin (@Roles)
// ============================================================================

import request from 'supertest';
import { ApplicationStatus, UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';

const fullChecklist = {
  dniValidated: true,
  cmpVerified: true,
  cvReviewed: true,
  interviewDone: true,
  documentsComplete: true,
  noInconsistencies: true,
};

describe('Applications (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('POST /api/applications (público) → 400 con cuerpo vacío (validación)', async () => {
    const res = await http().post('/api/applications').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/applications → 403 para PARENT, 200 para ADMIN', async () => {
    expect(
      (await http().get('/api/applications').set('Authorization', authAs(UserRole.PARENT))).status,
    ).toBe(403);

    ctx.prisma.medicalApplication.findMany.mockResolvedValue([]);
    const ok = await http().get('/api/applications').set('Authorization', authAs(UserRole.ADMIN));
    expect(ok.status).toBe(200);
  });

  it('GET /api/applications?status=PENDING filtra por estado (ADMIN)', async () => {
    ctx.prisma.medicalApplication.findMany.mockResolvedValue([]);
    const res = await http()
      .get('/api/applications?status=PENDING')
      .set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
  });

  it('GET /api/applications/:id detalle (ADMIN)', async () => {
    ctx.prisma.medicalApplication.findUnique.mockResolvedValue({
      id: 'app1',
      cvFileId: 'cv',
      dniFileId: 'dni',
      activationToken: 'secreto',
      activationExpiresAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const res = await http().get('/api/applications/app1').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('activationToken');
  });

  it('PATCH /api/applications/:id/reject → 200 (ADMIN)', async () => {
    ctx.prisma.medicalApplication.findUnique.mockResolvedValue({
      id: 'app1',
      status: ApplicationStatus.PENDING,
      email: 'ana@med.pe',
      firstName: 'Ana',
      lastName: 'Ruiz',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await http()
      .patch('/api/applications/app1/reject')
      .set('Authorization', authAs(UserRole.ADMIN))
      .send({ rejectionReason: 'La colegiatura no pudo ser verificada.' });

    expect(res.status).toBe(200);
  });

  it('PATCH /api/applications/:id/approve → 200 (ADMIN, checklist completo)', async () => {
    ctx.prisma.medicalApplication.findUnique.mockResolvedValue({
      id: 'app1',
      status: ApplicationStatus.PENDING,
      email: 'ana@med.pe',
      firstName: 'Ana',
      lastName: 'Ruiz',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.prisma.user.create.mockResolvedValue({ id: 'u-new' } as any);

    const res = await http()
      .patch('/api/applications/app1/approve')
      .set('Authorization', authAs(UserRole.ADMIN))
      .send({ checklist: fullChecklist });

    expect(res.status).toBe(200);
  });
});
