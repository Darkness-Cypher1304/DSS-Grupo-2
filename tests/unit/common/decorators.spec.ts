// ============================================================================
// Unit · Decoradores comunes (@Public, @Roles, @CurrentUser, @ClientIp)
// ============================================================================

import { UserRole } from '@prisma/client';

import {
  Public,
  Roles,
  CurrentUser,
  ClientIp,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../../../src/common/decorators';
import {
  createExecutionContext,
  getParamDecoratorFactory,
} from '../../mocks/execution-context.mock';
import { parentUser } from '../../fixtures/users.fixture';

describe('decoradores comunes', () => {
  describe('@Public()', () => {
    it('marca la clase/handler con IS_PUBLIC_KEY = true', () => {
      class Target {}
      Public()(Target);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, Target)).toBe(true);
    });
  });

  describe('@Roles()', () => {
    it('guarda los roles en ROLES_KEY', () => {
      class Target {}
      Roles(UserRole.ADMIN, UserRole.SPECIALIST)(Target);
      expect(Reflect.getMetadata(ROLES_KEY, Target)).toEqual([
        UserRole.ADMIN,
        UserRole.SPECIALIST,
      ]);
    });
  });

  describe('@CurrentUser()', () => {
    const factory = getParamDecoratorFactory(CurrentUser);

    it('devuelve el usuario completo sin argumento', () => {
      const user = parentUser();
      const ctx = createExecutionContext({ request: { user } });
      expect(factory(undefined, ctx)).toEqual(user);
    });

    it('devuelve una propiedad concreta si se pide', () => {
      const user = parentUser();
      const ctx = createExecutionContext({ request: { user } });
      expect(factory('email', ctx)).toBe(user.email);
    });

    it('devuelve undefined si no hay usuario', () => {
      const ctx = createExecutionContext({ request: {} });
      expect(factory(undefined, ctx)).toBeUndefined();
    });
  });

  describe('@ClientIp()', () => {
    const factory = getParamDecoratorFactory(ClientIp);

    it('prefiere request.ip', () => {
      const ctx = createExecutionContext({ request: { ip: '1.2.3.4' } });
      expect(factory(undefined, ctx)).toBe('1.2.3.4');
    });

    it('usa X-Forwarded-For si no hay request.ip', () => {
      const ctx = createExecutionContext({
        request: { ip: undefined, headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' } },
      });
      expect(factory(undefined, ctx)).toBe('9.9.9.9');
    });

    it('cae a socket.remoteAddress y finalmente a "unknown"', () => {
      const ctxSocket = createExecutionContext({
        request: { ip: undefined, socket: { remoteAddress: '7.7.7.7' } },
      });
      expect(factory(undefined, ctxSocket)).toBe('7.7.7.7');

      const ctxUnknown = createExecutionContext({
        request: { ip: undefined, socket: {} },
      });
      expect(factory(undefined, ctxUnknown)).toBe('unknown');
    });
  });
});
