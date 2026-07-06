// ============================================================================
// Unit · AllExceptionsFilter (OWASP A10 — no filtrar detalles internos)
// ============================================================================

import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';

interface CapturedResponse {
  status: jest.Mock;
  json: jest.Mock;
}

function makeHost(): { host: ArgumentsHost; response: CapturedResponse } {
  const response: CapturedResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const request = {
    url: '/api/x',
    method: 'POST',
    ip: '1.2.3.4',
    headers: { 'user-agent': 'jest' },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function loggerMock(): PinoLogger {
  return { error: jest.fn(), warn: jest.fn(), log: jest.fn() } as unknown as PinoLogger;
}

describe('AllExceptionsFilter', () => {
  it('mapea HttpException con cuerpo string', () => {
    const logger = loggerMock();
    const { host, response } = makeHost();
    new AllExceptionsFilter(logger).catch(
      new HttpException('mensaje plano', HttpStatus.BAD_REQUEST),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'mensaje plano' }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('mapea HttpException con cuerpo objeto (array de mensajes → join)', () => {
    const { host, response } = makeHost();
    new AllExceptionsFilter(loggerMock()).catch(new BadRequestException(['e1', 'e2']), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'e1 · e2', error: 'Bad Request' }),
    );
  });

  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Conflict'],
    ['P2025', HttpStatus.NOT_FOUND, 'NotFound'],
    ['P2003', HttpStatus.BAD_REQUEST, 'BadRequest'],
    ['P9999', HttpStatus.BAD_REQUEST, 'DatabaseError'],
  ])('mapea Prisma %s → %d', (code, status, error) => {
    const { host, response } = makeHost();
    const err = new Prisma.PrismaClientKnownRequestError('db', {
      code,
      clientVersion: '5.22.0',
    });
    new AllExceptionsFilter(loggerMock()).catch(err, host);

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
  });

  it('mapea PrismaClientValidationError → 400', () => {
    const { host, response } = makeHost();
    const err = new Prisma.PrismaClientValidationError('bad', { clientVersion: '5.22.0' });
    new AllExceptionsFilter(loggerMock()).catch(err, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'ValidationError' }),
    );
  });

  it('error desconocido → 500 genérico y log de error', () => {
    const logger = loggerMock();
    const { host, response } = makeHost();
    new AllExceptionsFilter(logger).catch(new Error('interno'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ha ocurrido un error inesperado' }),
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('en producción NO incluye "details" en la respuesta', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { host, response } = makeHost();
      new AllExceptionsFilter(loggerMock()).catch(
        new HttpException('x', HttpStatus.BAD_REQUEST),
        host,
      );
      const body = response.json.mock.calls[0][0];
      expect(body).not.toHaveProperty('details');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
