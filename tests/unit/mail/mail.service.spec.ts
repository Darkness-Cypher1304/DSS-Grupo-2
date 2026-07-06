// ============================================================================
// Unit · MailService — selección de proveedor, plantillas y envío (best-effort)
// ============================================================================
// El envío real es I/O externa: se mockean fetch (Brevo), nodemailer (SMTP) y
// Resend. En modo "console" (sin proveedor) los correos no se envían: es el
// fallback de desarrollo y cubre la construcción de todas las plantillas HTML.
// ============================================================================

import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

import { MailService, ApplicationSummary } from '../../../src/mail/mail.service';

jest.mock('nodemailer');
jest.mock('resend');

function makeService(values: Record<string, string | undefined> = {}): MailService {
  const config = {
    get: (key: string, def?: unknown) => (key in values ? values[key] : def),
  } as unknown as ConfigService;
  return new MailService(config);
}

const summary: ApplicationSummary = {
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'ana@med.pe',
  phoneNumber: '999',
  licenseNumber: 'CMP1',
  specialty: 'Pediatría',
  university: 'UNMSM',
  country: 'PE',
  yearsOfExperience: 5,
  availability: 'Tardes',
  motivationLetter: 'Motivación',
  cvFileName: 'cv.pdf',
  dniFileName: 'dni.pdf',
};

describe('MailService', () => {
  describe('proveedor CONSOLA (fallback sin proveedor)', () => {
    let service: MailService;
    beforeEach(() => {
      service = makeService();
    });

    it('construye y "envía" todas las plantillas sin lanzar', async () => {
      await expect(service.sendVerificationEmail('a@test.pe', 'Ana <b>', 'tok')).resolves.toBeUndefined();
      await expect(service.sendPasswordResetEmail('a@test.pe', 'Ana', 'tok')).resolves.toBeUndefined();
      await expect(service.sendAnswerNotificationEmail('a@test.pe', 'Ana', 'Título')).resolves.toBeUndefined();
      await expect(service.sendQuestionAssignedEmail('a@test.pe', 'Ana', 'Título')).resolves.toBeUndefined();
      await expect(service.sendApplicationApprovedEmail('a@test.pe', 'Ana Ruiz', 'tok')).resolves.toBeUndefined();
      await expect(service.sendApplicationRejectedEmail('a@test.pe', 'Ana Ruiz', 'motivo')).resolves.toBeUndefined();
    });

    it('resumen de postulación con y sin LinkedIn', async () => {
      await expect(service.sendApplicationReceivedEmail('a@test.pe', 'Ana', summary)).resolves.toBeUndefined();
      await expect(
        service.sendApplicationReceivedEmail('a@test.pe', 'Ana', { ...summary, linkedinUrl: 'https://in/ana' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('constructor — selección de proveedor', () => {
    it('elige Brevo si hay BREVO_API_KEY', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;
      const service = makeService({ BREVO_API_KEY: 'k', BREVO_FROM_EMAIL: 'from@x.pe' });

      await service.sendVerificationEmail('a@test.pe', 'Ana', 'tok');

      expect(fetchMock).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.any(Object));
    });

    it('elige SMTP si hay SMTP_HOST/USER/PASS', async () => {
      const sendMail = jest.fn().mockResolvedValue({ messageId: 'id-1' });
      (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
      const service = makeService({ SMTP_HOST: 'smtp.x', SMTP_USER: 'u@x.pe', SMTP_PASS: 'p' });

      await service.sendVerificationEmail('a@test.pe', 'Ana', 'tok');

      expect(sendMail).toHaveBeenCalled();
    });

    it('elige Resend si hay RESEND_API_KEY', async () => {
      const send = jest.fn().mockResolvedValue({ data: { id: 'r1' }, error: null });
      (Resend as unknown as jest.Mock).mockImplementation(() => ({ emails: { send } }));
      const service = makeService({ RESEND_API_KEY: 'k' });

      await service.sendVerificationEmail('a@test.pe', 'Ana', 'tok');

      expect(send).toHaveBeenCalled();
    });
  });

  describe('send — rutas de error (best-effort, nunca lanzan)', () => {
    it('Brevo con respuesta no OK: registra y no lanza', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad') }) as unknown as typeof fetch;
      const service = makeService({ BREVO_API_KEY: 'k' });

      await expect(service.sendVerificationEmail('a@test.pe', 'Ana', 'tok')).resolves.toBeUndefined();
    });

    it('Resend con error: registra y no lanza', async () => {
      const send = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
      (Resend as unknown as jest.Mock).mockImplementation(() => ({ emails: { send } }));
      const service = makeService({ RESEND_API_KEY: 'k' });

      await expect(service.sendPasswordResetEmail('a@test.pe', 'Ana', 'tok')).resolves.toBeUndefined();
    });

    it('excepción del proveedor: se captura y no lanza', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
      const service = makeService({ BREVO_API_KEY: 'k' });

      await expect(service.sendVerificationEmail('a@test.pe', 'Ana', 'tok')).resolves.toBeUndefined();
    });
  });
});
