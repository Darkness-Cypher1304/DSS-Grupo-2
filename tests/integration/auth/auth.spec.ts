// ============================================================================
// Integration · Auth — routing, ValidationPipe, guard global y cookies
// ============================================================================

import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';
import { dbUser } from '../../fixtures/db-user.fixture';
import { USER_IDS } from '../../fixtures/users.fixture';

const STRONG = 'Zx9!vQ2#mLw7';

describe('Auth (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /api/auth/register', () => {
    it('201 y mensaje (envoltorio { data })', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(null);
      ctx.prisma.user.create.mockResolvedValue(dbUser({ id: 'u1' }));

      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'nuevo@test.pe', password: STRONG, fullName: 'Nuevo Padre' });

      expect(res.status).toBe(201);
      expect(res.body.data.message).toBeDefined();
    });

    it('400 si el email es inválido (ValidationPipe)', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'no-es-email', password: STRONG, fullName: 'Nuevo' });
      expect(res.status).toBe(400);
    });

    it('400 si llegan campos no permitidos (forbidNonWhitelisted — anti mass-assignment)', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'a@test.pe', password: STRONG, fullName: 'Nuevo', role: 'ADMIN' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('200, accessToken y cookie de refresh con credenciales válidas', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(
        dbUser({ status: UserStatus.ACTIVE, passwordHash: await bcrypt.hash(STRONG, 4) }),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' } as any);

      const res = await http().post('/api/auth/login').send({ email: 'padre@test.pe', password: STRONG });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('401 con credenciales inválidas', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(null);
      const res = await http().post('/api/auth/login').send({ email: 'x@test.pe', password: 'incorrecta' });
      expect(res.status).toBe(401);
    });
  });

  describe('rutas autenticadas (guard global)', () => {
    it('GET /api/auth/me → 401 sin token', async () => {
      expect((await http().get('/api/auth/me')).status).toBe(401);
    });

    it('GET /api/auth/me → 200 con token, devuelve el rol del JWT', async () => {
      const res = await http().get('/api/auth/me').set('Authorization', authAs(UserRole.PARENT));
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(UserRole.PARENT);
    });

    it('POST /api/auth/logout → 200 con token', async () => {
      const res = await http().post('/api/auth/logout').set('Authorization', authAs(UserRole.PARENT));
      expect(res.status).toBe(200);
    });

    it('GET /api/auth/sessions → 200 lista sesiones del usuario', async () => {
      ctx.prisma.refreshToken.findMany.mockResolvedValue([]);
      const res = await http().get('/api/auth/sessions').set('Authorization', authAs(UserRole.PARENT));
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/sessions/revoke-all → 200', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 } as any);
      const res = await http()
        .post('/api/auth/sessions/revoke-all')
        .set('Authorization', authAs(UserRole.PARENT));
      expect(res.status).toBe(200);
    });

    it('DELETE /api/auth/sessions/:id → 200 si la sesión es del usuario', async () => {
      ctx.prisma.refreshToken.findUnique.mockResolvedValue({
        id: 's1',
        userId: USER_IDS.parent,
        revokedAt: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const res = await http().delete('/api/auth/sessions/s1').set('Authorization', authAs(UserRole.PARENT));
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/change-password → 200 con la contraseña actual correcta', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: USER_IDS.parent, passwordHash: await bcrypt.hash('Actual#12345', 4) }),
      );
      const res = await http()
        .post('/api/auth/change-password')
        .set('Authorization', authAs(UserRole.PARENT))
        .send({ currentPassword: 'Actual#12345', newPassword: STRONG });
      expect(res.status).toBe(200);
    });
  });

  describe('endpoints públicos anti-enumeración', () => {
    it('POST /api/auth/forgot-password → 200 aunque el correo no exista', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(null);
      const res = await http().post('/api/auth/forgot-password').send({ email: 'nadie@test.pe' });
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/resend-verification → 200 (mensaje genérico)', async () => {
      ctx.prisma.user.findUnique.mockResolvedValue(null);
      const res = await http().post('/api/auth/resend-verification').send({ email: 'x@test.pe' });
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/verify-email → 200 con token válido', async () => {
      ctx.redis.getEmailVerificationUser.mockResolvedValue('u1');
      ctx.prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', emailVerificationExpiresAt: new Date(Date.now() + 60000) }),
      );
      const res = await http().post('/api/auth/verify-email').send({ token: 'a'.repeat(40) });
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/reset-password → 200 con token válido', async () => {
      ctx.redis.getPasswordResetUser.mockResolvedValue('u1');
      ctx.prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', passwordHash: await bcrypt.hash('OtraVieja#123', 4), passwordResetExpiresAt: new Date(Date.now() + 60000) }),
      );
      const res = await http()
        .post('/api/auth/reset-password')
        .send({ token: 'a'.repeat(40), newPassword: STRONG });
      expect(res.status).toBe(200);
    });
  });
});
