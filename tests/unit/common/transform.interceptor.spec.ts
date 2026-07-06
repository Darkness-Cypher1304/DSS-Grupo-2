// ============================================================================
// Unit · TransformInterceptor — envoltorio { data, meta }
// ============================================================================

import { firstValueFrom } from 'rxjs';

import { TransformInterceptor } from '../../../src/common/interceptors/transform.interceptor';
import {
  createExecutionContext,
  createCallHandler,
} from '../../mocks/execution-context.mock';

describe('TransformInterceptor', () => {
  it('envuelve la respuesta en { data, meta: { timestamp, path } }', async () => {
    const interceptor = new TransformInterceptor();
    const payload = { id: 'x', value: 42 };
    const ctx = createExecutionContext({ request: { url: '/api/recurso' } });

    const result$ = interceptor.intercept(ctx, createCallHandler(payload));
    const result = await firstValueFrom(result$);

    expect(result.data).toEqual(payload);
    expect(result.meta.path).toBe('/api/recurso');
    expect(typeof result.meta.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(result.meta.timestamp))).toBe(false);
  });
});
