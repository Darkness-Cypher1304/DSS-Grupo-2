// ============================================================================
// Unit · LoggingInterceptor — traza de cada request (OWASP A09)
// ============================================================================

import { of, throwError, firstValueFrom, lastValueFrom } from 'rxjs';
import { Logger as PinoLogger } from 'nestjs-pino';

import { LoggingInterceptor } from '../../../src/common/interceptors/logging.interceptor';
import { createExecutionContext } from '../../mocks/execution-context.mock';
import { parentUser } from '../../fixtures/users.fixture';

function loggerMock(): PinoLogger {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
}

describe('LoggingInterceptor', () => {
  it('loguea (log) en la ruta exitosa con método, url y status', async () => {
    const logger = loggerMock();
    const interceptor = new LoggingInterceptor(logger);
    const ctx = createExecutionContext({
      request: { method: 'GET', url: '/api/x', user: parentUser() },
      response: { statusCode: 200 },
    });

    await firstValueFrom(interceptor.intercept(ctx, { handle: () => of({ ok: true }) }));

    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('loguea (warn) y re-propaga en la ruta de error', async () => {
    const logger = loggerMock();
    const interceptor = new LoggingInterceptor(logger);
    const ctx = createExecutionContext({ request: { method: 'POST', url: '/api/y' } });

    const result$ = interceptor.intercept(ctx, {
      handle: () => throwError(() => new Error('boom')),
    });

    await expect(lastValueFrom(result$)).rejects.toThrow('boom');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
