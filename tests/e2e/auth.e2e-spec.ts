// ============================================================================
// E2E · Auth — ciclo real contra la BD: registro → verificación → login →
// /me → refresh (cookie HttpOnly) → logout, más negativos de seguridad.
// ============================================================================
// El correo está mockeado, así que el token de verificación se lee de la BD
// real (ver helpers/e2e-auth). Ejercita bcrypt, JWT, cookies firmadas y
// persistencia de refresh tokens en Postgres.
// ============================================================================

import request from 'supertest';

import { buildE2EApp, E2EApp } from './helpers/e2e-app';
import {
  registerAndVerify,
  registerVerifyLogin,
  uniqueEmail,
  E2E_PASSWORD,
} from './helpers/e2e-auth';

describe('Auth (e2e)', () => {
  let ctx: E2EApp;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await buildE2EApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('ciclo completo register → verify → login → GET /me', async () => {
    const user = await registerVerifyLogin(ctx.app, ctx.prisma);
    expect(user.accessToken).toBeTruthy();

    const me = await request(server()).get('/api/auth/me').set('Authorization', user.auth);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(user.email);
    expect(me.body.data.role).toBe('PARENT');
  });

  it('login ANTES de verificar el correo → 401', async () => {
    const email = uniqueEmail();
    const reg = await request(server())
      .post('/api/auth/register')
      .send({ email, password: E2E_PASSWORD, fullName: 'Padre Sin Verificar' });
    expect(reg.status).toBe(201);

    const login = await request(server())
      .post('/api/auth/login')
      .send({ email, password: E2E_PASSWORD });
    expect(login.status).toBe(401);
  });

  it('login con contraseña incorrecta → 401', async () => {
    const { email } = await registerAndVerify(ctx.app, ctx.prisma);
    const login = await request(server())
      .post('/api/auth/login')
      .send({ email, password: 'contrasena-incorrecta-2026' });
    expect(login.status).toBe(401);
  });

  it('refresh con la cookie HttpOnly rota el access token (200)', async () => {
    const { email } = await registerAndVerify(ctx.app, ctx.prisma);
    // Agente = mantiene la cookie de refresh entre requests (como un navegador).
    const agent = request.agent(server());

    const login = await agent.post('/api/auth/login').send({ email, password: E2E_PASSWORD });
    expect(login.status).toBe(200);

    const refresh = await agent.post('/api/auth/refresh').send();
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
  });

  it('logout de un usuario autenticado → 200', async () => {
    const user = await registerVerifyLogin(ctx.app, ctx.prisma);
    const logout = await request(server())
      .post('/api/auth/logout')
      .set('Authorization', user.auth);
    expect(logout.status).toBe(200);
  });
});
