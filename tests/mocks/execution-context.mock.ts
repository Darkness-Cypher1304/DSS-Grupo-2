// ============================================================================
// Helpers para probar guards, interceptores, filtros y param-decorators.
// ============================================================================
// Construyen un ExecutionContext falso (solo lo que estas piezas usan:
// switchToHttp().getRequest/getResponse, getHandler, getClass) y permiten
// extraer la "factory" de un createParamDecorator para probar su lógica.
// ============================================================================

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export interface MockRequestInit {
  user?: AnyObj;
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
  cookies?: AnyObj;
  body?: AnyObj;
}

export function createMockRequest(init: MockRequestInit = {}): AnyObj {
  return {
    headers: {},
    url: '/',
    method: 'GET',
    socket: {},
    ...init,
  };
}

export interface ExecutionContextInit {
  request?: MockRequestInit;
  response?: AnyObj;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler?: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class?: new (...args: any[]) => any;
}

export function createExecutionContext(init: ExecutionContextInit = {}): ExecutionContext {
  const request = createMockRequest(init.request);
  const response = init.response ?? { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const handler = init.handler ?? function testHandler(): void {};
  const cls = init.class ?? class TestClass {};

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => cls,
    getArgs: () => [request, response],
    getArgByIndex: (i: number) => [request, response][i],
    getType: () => 'http',
    // no usados por las piezas HTTP, pero completan el tipo
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ExecutionContext;
}

/** CallHandler que emite `value` (para interceptores). */
export function createCallHandler<T>(value: T): CallHandler<T> {
  return { handle: () => of(value) };
}

/**
 * Extrae la factory de un `createParamDecorator` para probar su lógica.
 * Patrón estándar de NestJS para unit-testear decoradores de parámetro.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getParamDecoratorFactory(decorator: (...args: any[]) => ParameterDecorator) {
  class Probe {
    test(@decorator() _value: unknown): void {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'test');
  return args[Object.keys(args)[0]].factory as (
    data: unknown,
    ctx: ExecutionContext,
  ) => unknown;
}
