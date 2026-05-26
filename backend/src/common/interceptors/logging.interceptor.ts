// ============================================================================
// LoggingInterceptor
// ============================================================================
// Loguea cada request: método, ruta, status, duración, usuario.
// OWASP A09: Security Logging Failures
// ============================================================================

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request & { user?: { sub?: string; role?: string } }>();
    const response = httpCtx.getResponse<Response>();
    const startTime = Date.now();

    const { method, url, ip } = request;
    const userId = request.user?.sub || 'anonymous';
    const userRole = request.user?.role || 'none';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            {
              method,
              url,
              statusCode: response.statusCode,
              duration,
              userId,
              userRole,
              ip,
            },
            `${method} ${url} ${response.statusCode} ${duration}ms`,
          );
        },
        error: (err: Error) => {
          // El error real lo maneja AllExceptionsFilter; aquí solo timing
          const duration = Date.now() - startTime;
          this.logger.warn(
            { method, url, duration, userId, ip, error: err.message },
            `${method} ${url} FAILED ${duration}ms`,
          );
        },
      }),
    );
  }
}
