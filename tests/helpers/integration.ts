// ============================================================================
// Helper de INTEGRACIÓN — construye la app real (AppModule) con Prisma/Mail/
// Redis MOCKEADOS y aplica los MISMOS globales que `main.ts`.
// ============================================================================
// Filosofía (equivalente a MSW en el frontend): se mockea la frontera (Prisma)
// y se ejercita la app completa con supertest. Sin base de datos real.
// ============================================================================

import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { UserRole } from '@prisma/client';

import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MailService } from '../../src/mail/mail.service';
import { RedisService } from '../../src/config/redis.service';
import type { AuthUser } from '../../src/common/decorators';

import { createPrismaMock, resetPrismaMock, PrismaMock } from '../mocks/prisma.mock';
import { createMailMock, MailMock } from '../mocks/mail.mock';
import { createRedisMock, resetRedisMock, RedisMock } from '../mocks/redis.mock';
import { authUser } from '../fixtures/users.fixture';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaMock;
  mail: MailMock;
  redis: RedisMock;
  moduleRef: TestingModule;
}

/**
 * Levanta la aplicación NestJS completa para pruebas de integración.
 * Prisma, Mail y Redis quedan mockeados (sin I/O externa ni DB).
 */
export async function buildApp(): Promise<TestApp> {
  const prisma = createPrismaMock();
  const mail = createMailMock();
  const redis = createRedisMock();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(RedisService)
    .useValue(redis)
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });
  app.useLogger(false);

  // --- MISMOS globales que main.ts (para comportarse como producción) ---
  app.use(cookieParser(process.env.JWT_REFRESH_SECRET));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(PinoLogger)));
  app.setGlobalPrefix('api', { exclude: ['health'] });

  await app.init();

  return { app, prisma, mail, redis, moduleRef };
}

/**
 * Reinicia los mocks a su estado por defecto (llamar en `afterEach`).
 * El mail mock no necesita reset explícito: `clearMocks` global limpia su
 * historial y conserva el fallback que resuelve las promesas.
 */
export function resetAppMocks(ctx: TestApp): void {
  resetPrismaMock(ctx.prisma);
  resetRedisMock(ctx.redis);
}

// ----------------------------------------------------------------------------
// Firma de JWT de prueba (coincide con lo que valida JwtStrategy: secret,
// issuer y audience). Devuelve el header Authorization listo para supertest.
// ----------------------------------------------------------------------------
const jwt = new JwtService();

export function signAccessToken(payload: Partial<AuthUser>): string {
  return jwt.sign(
    { email: payload.email, role: payload.role, jti: payload.jti, sub: payload.sub },
    {
      secret: process.env.JWT_ACCESS_SECRET,
      issuer: process.env.JWT_ISSUER ?? 'neuroalert',
      audience: process.env.JWT_AUDIENCE ?? 'neuroalert-users',
      expiresIn: '15m',
    },
  );
}

/** Header Authorization para un usuario del rol dado. */
export function authAs(role: UserRole, overrides: Partial<AuthUser> = {}): string {
  return `Bearer ${signAccessToken(authUser(role, overrides))}`;
}
