// ============================================================================
// Helper E2E — construye la app real (AppModule) con PrismaService REAL
// (conectado a una PostgreSQL de verdad) y los MISMOS globales que `main.ts`.
// ============================================================================
// Diferencia con el helper de INTEGRACIÓN (tests/helpers/integration.ts):
//   - Integración: Prisma MOCKEADO (frontera simulada, sin DB).
//   - E2E:         Prisma REAL → ejercita migraciones, SQL, transacciones y
//                  runWithUserContext contra un motor Postgres verdadero.
// Mail y Redis SÍ se mockean (no queremos enviar correos ni depender de Redis).
//
// ⚠️ RLS: con DB real se activa el camino de runWithUserContext (SET LOCAL). Pero
// el efecto de `FORCE ROW LEVEL SECURITY` NO se valida aquí: en CI la app conecta
// como SUPERUSUARIO de Postgres, que bypassa RLS siempre. El bloqueo efectivo de
// RLS FORCE solo se observa en Render (dueño no-superusuario). Ver README.md y
// docs/SECURITY-RLS.md. Este e2e valida flujos + aislamiento a nivel de app (404).
// ============================================================================

import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';

import { AppModule } from '../../../src/app.module';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { MailService } from '../../../src/mail/mail.service';
import { RedisService } from '../../../src/config/redis.service';

import { createMailMock, MailMock } from '../../mocks/mail.mock';
import { createRedisMock, RedisMock } from '../../mocks/redis.mock';

export interface E2EApp {
  app: INestApplication;
  prisma: PrismaService; // REAL (no mockeado)
  mail: MailMock;
  redis: RedisMock;
  moduleRef: TestingModule;
}

/**
 * Levanta la app NestJS completa con PrismaService REAL (usa DATABASE_URL).
 * Mail y Redis quedan mockeados. Requiere una DB migrada (`prisma migrate deploy`).
 */
export async function buildE2EApp(): Promise<E2EApp> {
  const mail = createMailMock();
  const redis = createRedisMock();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // NO se sobreescribe PrismaService → se usa el real (conecta a DATABASE_URL).
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(RedisService)
    .useValue(redis)
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });
  app.useLogger(false);

  // --- MISMOS globales que main.ts (comportamiento de producción) ---
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

  const prisma = app.get(PrismaService);
  return { app, prisma, mail, redis, moduleRef };
}
