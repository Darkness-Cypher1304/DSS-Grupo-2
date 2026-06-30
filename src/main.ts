// ============================================================================
// NeuroAlert · Backend · Entrypoint principal
// ============================================================================
// Aquí se aplican TODAS las defensas globales antes de que un request
// llegue a un controller. Es el equivalente a la "puerta blindada"
// de la aplicación.
// ============================================================================

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // No revelar información de error en respuestas por defecto
    abortOnError: false,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // --------------------------------------------------------------------------
  // Logger estructurado (Pino) — JSON en prod, pretty en dev
  // OWASP A09: Security Logging Failures
  // --------------------------------------------------------------------------
  app.useLogger(app.get(PinoLogger));

  // --------------------------------------------------------------------------
  // Helmet — añade ~15 headers de seguridad de un golpe
  // OWASP A05: Security Misconfiguration
  // --------------------------------------------------------------------------
  app.use(
    helmet({
      // CSP: antes la ponía Nginx, pero al migrar a Render (sin Nginx) la API
      // quedó SIN CSP. La API solo sirve JSON; el único HTML es Swagger UI, y
      // SOLO en dev (NODE_ENV!=production). Por eso la política permite
      // 'unsafe-inline' en script-src —necesario para el script inline de
      // Swagger UI—; en una API JSON eso es inocuo (no hay HTML donde inyectar).
      // Los assets de Swagger se sirven same-origin ('self', heredado de los
      // defaults de helmet). frame-ancestors 'none' refuerza anti-clickjacking.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 63072000, // 2 años
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // --------------------------------------------------------------------------
  // CORS — solo el frontend autorizado puede consumir la API
  // --------------------------------------------------------------------------
  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',');
  app.enableCors({
    origin: corsOrigins,
    credentials: true, // permite cookies httpOnly (refresh token)
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // cache de preflight 24h
  });

  // --------------------------------------------------------------------------
  // Cookies — necesario para refresh tokens en cookies HttpOnly
  // --------------------------------------------------------------------------
  app.use(cookieParser(config.get<string>('JWT_REFRESH_SECRET')));

  // --------------------------------------------------------------------------
  // Compresión Gzip
  // --------------------------------------------------------------------------
  app.use(compression());

  // --------------------------------------------------------------------------
  // Trust proxy (estamos detrás de Nginx)
  // --------------------------------------------------------------------------
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // --------------------------------------------------------------------------
  // VALIDATION PIPE GLOBAL — class-validator en cada DTO
  // OWASP A03: Injection (parte de la mitigación)
  // --------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // remueve campos no declarados en el DTO
      forbidNonWhitelisted: true, // ERROR si llegan campos extra (mass assignment)
      transform: true,            // convierte payload a instancia de la clase
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,    // muestra todos los errores de validación
    }),
  );

  // --------------------------------------------------------------------------
  // SERIALIZER INTERCEPTOR GLOBAL — respeta @Exclude/@Expose en entidades
  // Previene leaks accidentales de campos sensibles (passwordHash, tokens)
  // --------------------------------------------------------------------------
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // --------------------------------------------------------------------------
  // FILTRO DE EXCEPCIONES GLOBAL
  // OWASP A10 (NUEVO 2025): Mishandling of Exceptional Conditions
  // Nunca se exponen stack traces ni detalles internos al cliente.
  // --------------------------------------------------------------------------
  app.useGlobalFilters(new AllExceptionsFilter(app.get(PinoLogger)));

  // --------------------------------------------------------------------------
  // Prefijo global /api
  // --------------------------------------------------------------------------
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // --------------------------------------------------------------------------
  // Swagger / OpenAPI — solo en desarrollo
  // --------------------------------------------------------------------------
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NeuroAlert API')
      .setDescription('API de detección temprana del TEA · Documentación OpenAPI')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('📚 Swagger disponible en /api/docs');
  }

  // --------------------------------------------------------------------------
  // GRACEFUL SHUTDOWN — cierra conexiones a BD, Redis al recibir SIGTERM
  // --------------------------------------------------------------------------
  app.enableShutdownHooks();

  // --------------------------------------------------------------------------
  // Arrancar servidor
  // --------------------------------------------------------------------------
  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 NeuroAlert API corriendo en http://localhost:${port}`);
  logger.log(`🔐 Modo: ${config.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((err) => {
  console.error('❌ Error fatal al arrancar:', err);
  process.exit(1);
});
