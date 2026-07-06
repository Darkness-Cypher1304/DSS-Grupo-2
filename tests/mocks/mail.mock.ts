// ============================================================================
// Mock de MailService — el envío de correo es I/O externa (Brevo/SMTP/Resend).
// Se mockea por completo para no enviar correos reales en las pruebas.
// ============================================================================
// Todos los métodos de envío son async (Promise<void>). Con
// `fallbackMockImplementation` cualquier método devuelve una promesa resuelta
// por defecto, para que el patrón fire-and-forget (`dispatchMail`) no rompa.
// ============================================================================

import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { MailService } from '../../src/mail/mail.service';

export type MailMock = DeepMockProxy<MailService>;

export function createMailMock(): MailMock {
  return mockDeep<MailService>({ fallbackMockImplementation: () => Promise.resolve() });
}
