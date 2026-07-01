// ============================================================================
// NeuroAlert · Módulo raíz (AppModule)
// ============================================================================
// Compone toda la aplicación. Aplica:
//   - ConfigModule global con validación
//   - ThrottlerModule (rate limiting)
//   - PinoLogger
//   - JwtAuthGuard como APP_GUARD global (Complete Mediation)
// ============================================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContentModule } from './content/content.module';
import { QuestionsModule } from './questions/questions.module';
import { MchatModule } from './mchat/mchat.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ApplicationsModule } from './applications/applications.module';
import { HealthModule } from './health/health.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    // ------------------------------------------------------------------------
    // ConfigModule global con validación al arrancar
    // ------------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // En producción, validaríamos con Joi que las variables existan.
      // Aquí confiamos en .env.example bien documentado.
    }),

    // ------------------------------------------------------------------------
    // Logger estructurado (Pino) — JSON en prod, pretty en dev
    // ------------------------------------------------------------------------
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', 'info'),
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname,req.headers,res.headers',
                  },
                },
            // Redactar campos sensibles AUTOMÁTICAMENTE de los logs
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.passwordHash',
                'req.body.currentPassword',
                'req.body.newPassword',
                'req.body.token',
                'req.body.refreshToken',
                'req.body.emailVerificationToken',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            customProps: () => ({ context: 'HTTP' }),
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
              }),
            },
          },
        };
      },
    }),

    // ------------------------------------------------------------------------
    // Rate Limiting global
    // OWASP A04: prevención de DoS y brute force
    // ------------------------------------------------------------------------
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'global',
          ttl: parseInt(config.get('THROTTLE_TTL', '60'), 10) * 1000,
          limit: parseInt(config.get('THROTTLE_LIMIT', '100'), 10),
        },
      ],
    }),

    // ------------------------------------------------------------------------
    // Módulos de infraestructura
    // ------------------------------------------------------------------------
    PrismaModule,
    RedisModule,

    // ------------------------------------------------------------------------
    // Módulos de dominio
    // ------------------------------------------------------------------------
    AuthModule,
    UsersModule,
    ContentModule,
    QuestionsModule,
    MchatModule,
    AuditModule,
    MailModule,
    StorageModule,
    NotificationsModule,
    ApplicationsModule,
    HealthModule,
  ],
  providers: [
    // ------------------------------------------------------------------------
    // GUARD GLOBAL DE AUTENTICACIÓN (Complete Mediation)
    // Cada request se valida contra JWT por defecto.
    // Para hacer un endpoint público se usa @Public().
    // ------------------------------------------------------------------------
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // ------------------------------------------------------------------------
    // GUARD GLOBAL DE ROLES (RBAC)
    // ------------------------------------------------------------------------
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // ------------------------------------------------------------------------
    // GUARD GLOBAL DE THROTTLER (rate limit)
    // ------------------------------------------------------------------------
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ------------------------------------------------------------------------
    // INTERCEPTORS GLOBALES
    // ------------------------------------------------------------------------
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
