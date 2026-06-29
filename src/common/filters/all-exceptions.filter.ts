// ============================================================================
// AllExceptionsFilter
// ============================================================================
// OWASP A10:2025 — Mishandling of Exceptional Conditions
// NUNCA exponemos stack traces ni detalles internos al cliente.
// El cliente recibe un mensaje genérico; los detalles van solo a logs internos.
// ============================================================================

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  // SOLO en desarrollo:
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isDev = process.env.NODE_ENV !== 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ha ocurrido un error inesperado';
    let errorName = 'InternalServerError';
    let details: unknown = undefined;

    // ----------------------------------------------------------------------
    // Excepciones controladas de NestJS (HttpException)
    // ----------------------------------------------------------------------
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      errorName = exception.constructor.name;

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as { message?: string | string[]; error?: string };
        message = body.message || message;
        errorName = body.error || errorName;
      }
    }
    // ----------------------------------------------------------------------
    // Errores conocidos de Prisma — los mapeamos a códigos HTTP correctos
    // ----------------------------------------------------------------------
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // unique constraint
          status = HttpStatus.CONFLICT;
          message = 'El recurso ya existe';
          errorName = 'Conflict';
          break;
        case 'P2025': // record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Recurso no encontrado';
          errorName = 'NotFound';
          break;
        case 'P2003': // foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          message = 'Referencia inválida';
          errorName = 'BadRequest';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Error en la operación de base de datos';
          errorName = 'DatabaseError';
      }
    }
    // ----------------------------------------------------------------------
    // Validación fallida de Prisma (raro, suele atajarse antes con DTOs)
    // ----------------------------------------------------------------------
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Datos inválidos';
      errorName = 'ValidationError';
    }
    // ----------------------------------------------------------------------
    // CUALQUIER OTRO error desconocido — log completo, respuesta genérica
    // FAIL-SAFE DEFAULTS: si no sabemos qué pasó, denegamos
    // ----------------------------------------------------------------------
    else {
      const err = exception as Error;
      this.logger.error(
        {
          err,
          path: request.url,
          method: request.method,
          ip: request.ip,
        },
        '🚨 Excepción no controlada',
      );
    }

    // ----------------------------------------------------------------------
    // En desarrollo, incluimos detalles para debugging.
    // En producción, mensaje limpio.
    // ----------------------------------------------------------------------
    if (isDev && exception instanceof Error) {
      details = {
        name: exception.name,
        // El stack solo en logs, nunca en respuesta HTTP — pero en dev sí ayuda
        // OJO: en producción esto se omite siempre.
      };
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: Array.isArray(message) ? message.join(' · ') : message,
      error: errorName,
      ...(isDev && details ? { details } : {}),
    };

    // Log estructurado: detalles SOLO van a logs, nunca al cliente
    if (status >= 500) {
      this.logger.error(
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          err: exception instanceof Error ? exception : { raw: String(exception) },
        },
        `Error ${status}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          ip: request.ip,
          message,
        },
        `Client error ${status}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
