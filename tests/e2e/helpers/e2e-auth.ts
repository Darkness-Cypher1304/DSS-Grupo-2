// ============================================================================
// Helpers de autenticación para E2E — usan la API REAL contra la BD real.
// ============================================================================
// A diferencia de la integración (que firma un JWT de fixture con `authAs`),
// el e2e necesita usuarios REALES en la BD: mchat_screenings.parentId es FK a
// users.id, y los tokens deben corresponder a un usuario existente. Por eso el
// flujo real es: register → (leer token de verificación de la BD) → verify → login.
// El correo está mockeado, así que el token se obtiene consultando la BD.
// ============================================================================

import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import { PrismaService } from '../../../src/prisma/prisma.service';

// ≥12 chars y NO común (pasa MinLength(12) del DTO y el blocklist server-side).
export const E2E_PASSWORD = 'E2E-NeuroAlert-Secret-2026';

let seq = 0;
/** Email único por llamada (evita colisiones entre tests y reejecuciones). */
export function uniqueEmail(prefix = 'e2e'): string {
  seq += 1;
  return `${prefix}.${Date.now()}.${seq}@e2e.test`;
}

export interface E2EUser {
  email: string;
  userId: string;
  accessToken: string;
  /** Cabecera Authorization lista para supertest. */
  auth: string;
}

/**
 * Registra un usuario (PARENT por defecto) y lo deja VERIFICADO (ACTIVE),
 * leyendo el token de verificación directamente de la BD (el correo está mockeado).
 * Devuelve el email y el id real del usuario.
 */
export async function registerAndVerify(
  app: INestApplication,
  prisma: PrismaService,
  opts: { email?: string; fullName?: string } = {},
): Promise<{ email: string; userId: string }> {
  const http = request(app.getHttpServer());
  const email = opts.email ?? uniqueEmail();
  const fullName = opts.fullName ?? 'Padre E2E Test'; // solo letras/espacios (regex del DTO)

  const reg = await http
    .post('/api/auth/register')
    .send({ email, password: E2E_PASSWORD, fullName });
  if (reg.status !== 201) {
    throw new Error(`register falló (${reg.status}): ${JSON.stringify(reg.body)}`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerificationToken: true },
  });
  if (!user?.emailVerificationToken) {
    throw new Error('No se generó el token de verificación en la BD');
  }

  const verify = await http
    .post('/api/auth/verify-email')
    .send({ token: user.emailVerificationToken });
  if (verify.status !== 200) {
    throw new Error(`verify-email falló (${verify.status}): ${JSON.stringify(verify.body)}`);
  }

  return { email, userId: user.id };
}

/**
 * Registra, verifica e inicia sesión. Devuelve el accessToken real y la cabecera
 * Authorization lista para usar en supertest.
 */
export async function registerVerifyLogin(
  app: INestApplication,
  prisma: PrismaService,
  opts: { email?: string; fullName?: string } = {},
): Promise<E2EUser> {
  const { email, userId } = await registerAndVerify(app, prisma, opts);

  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: E2E_PASSWORD });
  if (login.status !== 200) {
    throw new Error(`login falló (${login.status}): ${JSON.stringify(login.body)}`);
  }

  const accessToken = login.body?.data?.accessToken as string;
  return { email, userId, accessToken, auth: `Bearer ${accessToken}` };
}
