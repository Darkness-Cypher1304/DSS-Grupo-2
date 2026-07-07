// ============================================================================
// Comparación en tiempo constante (anti timing side-channel)
// ============================================================================
// Al validar secretos o firmas HMAC, comparar con `===`/`!==` corta en el
// primer byte distinto: el tiempo de respuesta filtra cuántos bytes iniciales
// coincidieron y permite reconstruir el valor esperado byte a byte (CWE-208).
// `crypto.timingSafeEqual` compara en tiempo constante para longitudes iguales.
// ============================================================================

import { timingSafeEqual } from 'crypto';

/**
 * Compara dos cadenas en TIEMPO CONSTANTE.
 *
 * `timingSafeEqual` lanza si los buffers difieren en longitud; por eso primero
 * se contrasta la longitud y, si difiere, se rechaza. Esa comparación de
 * longitud solo revela el tamaño del valor esperado (fijo para una firma HMAC
 * o un secreto configurado), nunca su contenido.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
