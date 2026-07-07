// ============================================================================
// Unit · constantTimeEqual — comparación en tiempo constante (anti timing)
// ============================================================================

import { constantTimeEqual } from '../../../src/common/security/constant-time';

describe('constantTimeEqual', () => {
  it('devuelve true para cadenas idénticas', () => {
    expect(constantTimeEqual('firma-hmac-abc123', 'firma-hmac-abc123')).toBe(true);
  });

  it('devuelve false para cadenas de IGUAL longitud pero distinto contenido', () => {
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false);
  });

  it('devuelve false (sin lanzar) para cadenas de DISTINTA longitud', () => {
    // timingSafeEqual lanzaría con longitudes desiguales; el guard lo evita.
    expect(constantTimeEqual('corto', 'una-cadena-mucho-mas-larga')).toBe(false);
  });

  it('devuelve true para dos cadenas vacías', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
