// ============================================================================
// Unit · Transforms de DTOs (@Transform de class-transformer)
// ============================================================================
// Los DTOs no son "solo decoradores": normalizan la entrada (email a minúsculas,
// coacción de números en multipart). Se prueban ambas ramas del transform con
// plainToInstance, que ejecuta los @Transform sin necesidad de un request.
// ============================================================================

import { plainToInstance } from 'class-transformer';

import { RegisterDto, LoginDto, RequestPasswordResetDto } from '../../../src/auth/dto/auth.dto';
import { ResendVerificationDto } from '../../../src/auth/dto/auth.dto';
import { SubmitApplicationDto } from '../../../src/applications/dto/applications.dto';

describe('Transforms de DTOs', () => {
  describe('normalización de email (rama string vs no-string)', () => {
    it('recorta y pasa a minúsculas cuando es string', () => {
      expect(plainToInstance(RegisterDto, { email: '  MARIA@Test.PE  ' }).email).toBe('maria@test.pe');
      expect(plainToInstance(LoginDto, { email: ' A@B.PE ' }).email).toBe('a@b.pe');
      expect(plainToInstance(RequestPasswordResetDto, { email: 'X@Y.PE ' }).email).toBe('x@y.pe');
      expect(plainToInstance(ResendVerificationDto, { email: ' Z@W.PE' }).email).toBe('z@w.pe');
    });

    it('deja el valor intacto cuando NO es string (rama defensiva)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(plainToInstance(RegisterDto, { email: 12345 as any }).email).toBe(12345);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(plainToInstance(SubmitApplicationDto, { email: 42 as any }).email).toBe(42);
    });
  });

  describe('coacción de números (multipart → number)', () => {
    it('convierte string numérico a número', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(plainToInstance(SubmitApplicationDto, { yearsOfExperience: '7' as any }).yearsOfExperience).toBe(7);
    });

    it('respeta un valor ya numérico', () => {
      expect(plainToInstance(SubmitApplicationDto, { yearsOfExperience: 9 }).yearsOfExperience).toBe(9);
    });
  });
});
