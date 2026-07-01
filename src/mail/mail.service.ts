// ============================================================================
// MailService
// ============================================================================
// Envía correos transaccionales usando Resend.
// FALLBACK INTELIGENTE: si RESEND_API_KEY no está configurada, los correos
// se imprimen en consola en lugar de enviarse — así la app funciona aunque
// no tengas una cuenta de Resend (perfecto para sustentación local).
// ============================================================================

import { Global, Module, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

type MailProvider = 'brevo' | 'smtp' | 'resend' | 'console';

// Correo de soporte de NeuroAlert (parámetro global fijo del proyecto).
export const SUPPORT_EMAIL = 'U20241E211@UPC.EDU.PE';

// Resumen de la postulación para el correo de confirmación (pantalla 11).
export interface ApplicationSummary {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  licenseNumber: string;
  specialty: string;
  university: string;
  country: string;
  linkedinUrl?: string;
  yearsOfExperience: number;
  availability: string;
  motivationLetter: string;
  cvFileName: string;
  dniFileName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly smtp: Transporter | null;
  private readonly brevoApiKey: string | null;
  private readonly provider: MailProvider;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('RESEND_FROM_NAME', 'NeuroAlert');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const brevoKey = this.config.get<string>('BREVO_API_KEY');
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    const resendKey = this.config.get<string>('RESEND_API_KEY');

    // Cadena de proveedores (el primero configurado gana). PRIORIDAD a los que
    // envían por API HTTP (puerto 443): Render BLOQUEA los puertos SMTP (25/465/587)
    // en el plan gratuito desde sep-2025 → SMTP NO funciona en Render (sí en local).
    //   1) Brevo (API HTTP) → gratis 300/día, SIN dominio, a cualquier destinatario.
    //   2) Resend (API HTTP) → requiere dominio verificado para destinatarios arbitrarios.
    //   3) SMTP (p.ej. Gmail) → solo útil en LOCAL (en Render free queda bloqueado).
    //   4) Consola → fallback de desarrollo (imprime el enlace en los logs).
    if (brevoKey && brevoKey.trim().length > 0) {
      this.brevoApiKey = brevoKey.trim();
      this.resend = null;
      this.smtp = null;
      this.provider = 'brevo';
      // Remitente: debe ser un sender VERIFICADO en Brevo (p.ej. el Gmail del equipo).
      this.fromEmail =
        this.config.get<string>('BREVO_FROM_EMAIL') ||
        smtpUser ||
        this.config.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
      this.logger.log('✅ Brevo (API HTTP) configurado — correos por HTTPS (Render no bloquea el 443)');
    } else if (smtpHost && smtpUser && smtpPass) {
      this.brevoApiKey = null;
      this.smtp = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(this.config.get<string>('SMTP_PORT', '465'), 10),
        secure: this.config.get<string>('SMTP_SECURE', 'true') === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.resend = null;
      this.provider = 'smtp';
      // `fromEmail` es solo el email (el nombre lo añade send()); en Gmail debe
      // coincidir con la cuenta autenticada. OJO: Render free bloquea SMTP saliente.
      this.fromEmail = smtpUser;
      this.logger.log('✅ SMTP configurado — correos por SMTP (OJO: Render free bloquea los puertos SMTP)');
    } else if (resendKey && resendKey.trim().length > 0) {
      this.brevoApiKey = null;
      this.resend = new Resend(resendKey);
      this.smtp = null;
      this.provider = 'resend';
      this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
      this.logger.log('✅ Resend configurado — correos por API HTTP');
    } else {
      this.brevoApiKey = null;
      this.resend = null;
      this.smtp = null;
      this.provider = 'console';
      this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
      this.logger.warn(
        '⚠️  Sin proveedor de correo (BREVO_API_KEY / SMTP_* / RESEND_API_KEY) — los correos se imprimirán en consola',
      );
    }
  }

  // --------------------------------------------------------------------------
  // VERIFICACIÓN DE EMAIL
  // --------------------------------------------------------------------------
  async sendVerificationEmail(to: string, fullName: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = '✅ Verifica tu correo en NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">¡Bienvenido a NeuroAlert!</h1>
      <p>Hola <strong>${this.escapeHtml(fullName)}</strong>,</p>
      <p>
        Gracias por crear tu cuenta. Para activarla, haz clic en el botón:
      </p>
      <p style="text-align:center;margin:32px 0">
        <a href="${verifyUrl}" style="background:#0f4c47;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Verificar mi correo
        </a>
      </p>
      <p style="color:#666;font-size:14px">
        O copia este enlace en tu navegador:<br>
        <span style="word-break:break-all;color:#0f4c47">${verifyUrl}</span>
      </p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Este enlace expira en 1 hora. Si no creaste esta cuenta, ignora este mensaje.
      </p>
    `);

    const text = `
Hola ${fullName},

Gracias por registrarte en NeuroAlert. Verifica tu correo:
${verifyUrl}

Este enlace expira en 1 hora.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // RESETEO DE CONTRASEÑA
  // --------------------------------------------------------------------------
  async sendPasswordResetEmail(to: string, fullName: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = '🔐 Recuperación de contraseña — NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Recuperación de contraseña</h1>
      <p>Hola <strong>${this.escapeHtml(fullName)}</strong>,</p>
      <p>Recibimos una solicitud para resetear tu contraseña.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${resetUrl}" style="background:#0f4c47;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Crear nueva contraseña
        </a>
      </p>
      <p style="color:#666;font-size:14px">
        O copia este enlace:<br>
        <span style="word-break:break-all;color:#0f4c47">${resetUrl}</span>
      </p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Este enlace expira en 15 minutos. Si no solicitaste el cambio, ignora este mensaje
        — tu contraseña permanece intacta.
      </p>
    `);

    const text = `
Hola ${fullName},

Para resetear tu contraseña en NeuroAlert:
${resetUrl}

Este enlace expira en 15 minutos. Si no lo solicitaste, ignora este mensaje.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // NOTIFICACIÓN: CONSULTA RESPONDIDA (RF-31)
  // --------------------------------------------------------------------------
  async sendAnswerNotificationEmail(
    to: string,
    fullName: string,
    questionTitle: string,
  ): Promise<void> {
    const consultUrl = `${this.frontendUrl}/ask`;
    const subject = '💬 Un especialista respondió tu consulta — NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Tienes una respuesta</h1>
      <p>Hola <strong>${this.escapeHtml(fullName)}</strong>,</p>
      <p>Un especialista verificado respondió tu consulta:</p>
      <p style="background:#f0f7f6;border-left:3px solid #0f4c47;padding:12px 16px;border-radius:6px;color:#0f4c47;font-style:italic">
        "${this.escapeHtml(questionTitle)}"
      </p>
      <p style="text-align:center;margin:32px 0">
        <a href="${consultUrl}" style="background:#0f4c47;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ver la respuesta
        </a>
      </p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Recuerda: la orientación de los especialistas es educativa y no sustituye un
        diagnóstico profesional.
      </p>
    `);

    const text = `
Hola ${fullName},

Un especialista respondió tu consulta: "${questionTitle}"
Ve la respuesta en: ${consultUrl}

La orientación es educativa y no sustituye un diagnóstico profesional.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // NOTIFICACIÓN: CONSULTA TOMADA POR UN ESPECIALISTA
  // --------------------------------------------------------------------------
  async sendQuestionAssignedEmail(
    to: string,
    fullName: string,
    questionTitle: string,
  ): Promise<void> {
    const consultUrl = `${this.frontendUrl}/ask`;
    const subject = '👩‍⚕️ Un especialista tomó tu consulta — NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Tu consulta está en revisión</h1>
      <p>Hola <strong>${this.escapeHtml(fullName)}</strong>,</p>
      <p>Un especialista verificado tomó tu consulta y la está revisando:</p>
      <p style="background:#f0f7f6;border-left:3px solid #0f4c47;padding:12px 16px;border-radius:6px;color:#0f4c47;font-style:italic">
        "${this.escapeHtml(questionTitle)}"
      </p>
      <p>Te avisaremos en cuanto haya una respuesta.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${consultUrl}" style="background:#0f4c47;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Ver mi consulta
        </a>
      </p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Recuerda: la orientación de los especialistas es educativa y no sustituye un
        diagnóstico profesional.
      </p>
    `);

    const text = `
Hola ${fullName},

Un especialista tomó tu consulta y la está revisando: "${questionTitle}"
Síguela en: ${consultUrl}

Te avisaremos cuando haya una respuesta.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // POSTULACIÓN RECIBIDA (pantalla 11) — con RESUMEN COMPLETO de lo enviado
  // --------------------------------------------------------------------------
  async sendApplicationReceivedEmail(
    to: string,
    fullName: string,
    summary: ApplicationSummary,
  ): Promise<void> {
    const lastName = this.escapeHtml(summary.lastName);
    const subject = '📋 Recibimos tu postulación — NeuroAlert';

    const row = (label: string, value: string): string => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;white-space:nowrap;vertical-align:top">${this.escapeHtml(label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:13px">${this.escapeHtml(value)}</td>
      </tr>`;

    const summaryRows = [
      row('Nombre', summary.firstName),
      row('Apellido', summary.lastName),
      row('Correo', summary.email),
      row('Teléfono', summary.phoneNumber),
      row('Colegiatura (CMP)', summary.licenseNumber),
      row('Especialidad', summary.specialty),
      row('Universidad', summary.university),
      row('País', summary.country),
      summary.linkedinUrl ? row('LinkedIn', summary.linkedinUrl) : '',
      row('Años de experiencia', String(summary.yearsOfExperience)),
      row('Disponibilidad', summary.availability),
      row('Carta de motivación', summary.motivationLetter),
      row('Currículum (PDF)', summary.cvFileName),
      row('Documento de identidad', summary.dniFileName),
    ].join('');

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Solicitud recibida correctamente</h1>
      <p>Hola <strong>Dr(a). ${lastName}</strong>,</p>
      <p>
        Hemos recibido tu solicitud para formar parte del equipo de especialistas de NeuroAlert.
        Nuestro equipo revisará tu información y se comunicará contigo para coordinar una reunión de evaluación.
      </p>
      <p style="color:#666;font-size:14px">
        Si detectas algún error en tus datos, escríbenos a
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#0f4c47">${SUPPORT_EMAIL}</a>.
      </p>
      <h2 style="margin:28px 0 8px;color:#0f4c47;font-size:16px">Resumen de tu postulación</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
        ${summaryRows}
      </table>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Revisa que todo esté correcto. Aún no se ha creado ninguna cuenta: eso ocurrirá solo si tu
        postulación es aprobada, cuando recibirás un enlace para activar tu cuenta.
      </p>
    `);

    const text = `
Hola Dr(a). ${summary.lastName},

Recibimos tu postulación para el equipo de especialistas de NeuroAlert. La revisaremos y te
contactaremos para coordinar una reunión de evaluación. Si hay algún error, escribe a ${SUPPORT_EMAIL}.

Resumen de tu postulación:
- Nombre: ${summary.firstName}
- Apellido: ${summary.lastName}
- Correo: ${summary.email}
- Teléfono: ${summary.phoneNumber}
- Colegiatura (CMP): ${summary.licenseNumber}
- Especialidad: ${summary.specialty}
- Universidad: ${summary.university}
- País: ${summary.country}${summary.linkedinUrl ? `\n- LinkedIn: ${summary.linkedinUrl}` : ''}
- Años de experiencia: ${summary.yearsOfExperience}
- Disponibilidad: ${summary.availability}
- Carta de motivación: ${summary.motivationLetter}
- Currículum (PDF): ${summary.cvFileName}
- Documento de identidad: ${summary.dniFileName}

Aún no se ha creado ninguna cuenta; eso ocurrirá solo si tu postulación es aprobada.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // POSTULACIÓN APROBADA (pantalla 13) — SIN contraseña, con enlace de activación
  // --------------------------------------------------------------------------
  async sendApplicationApprovedEmail(to: string, fullName: string, token: string): Promise<void> {
    const activateUrl = `${this.frontendUrl}/activar?token=${encodeURIComponent(token)}`;
    const lastName = this.escapeHtml(fullName.split(' ').slice(-1)[0] || fullName);
    const subject = '🎉 Bienvenido al equipo de NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Bienvenido al equipo de NeuroAlert</h1>
      <p>Hola <strong>Dr(a). ${lastName}</strong>,</p>
      <p>Tu solicitud ha sido <strong>aprobada</strong>. Ya formas parte de nuestro equipo de especialistas.</p>
      <p>Para activar tu cuenta y crear tu contraseña, haz clic en el botón:</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${activateUrl}" style="background:#0f4c47;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Activar mi cuenta
        </a>
      </p>
      <p style="color:#666;font-size:14px">
        O copia este enlace en tu navegador:<br>
        <span style="word-break:break-all;color:#0f4c47">${activateUrl}</span>
      </p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Por seguridad, este enlace expira en 24 horas y es de un solo uso. Nunca te enviaremos una
        contraseña por correo: tú la defines al activar tu cuenta.
        Si detectas alguna inconsistencia, contáctanos a
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#0f4c47">${SUPPORT_EMAIL}</a>.
      </p>
    `);

    const text = `
Hola Dr(a). ${fullName},

Tu solicitud fue APROBADA. Ya formas parte del equipo de especialistas de NeuroAlert.
Activa tu cuenta y crea tu contraseña aquí (enlace de un solo uso, expira en 24 h):
${activateUrl}

Nunca enviamos contraseñas por correo: tú la defines al activar.
¿Alguna inconsistencia? Escríbenos a ${SUPPORT_EMAIL}.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // POSTULACIÓN RECHAZADA (con motivo)
  // --------------------------------------------------------------------------
  async sendApplicationRejectedEmail(to: string, fullName: string, reason: string): Promise<void> {
    const lastName = this.escapeHtml(fullName.split(' ').slice(-1)[0] || fullName);
    const subject = 'Sobre tu postulación — NeuroAlert';

    const html = this.layout(`
      <h1 style="margin:0 0 16px;color:#0f4c47;font-size:24px">Resultado de tu postulación</h1>
      <p>Hola <strong>Dr(a). ${lastName}</strong>,</p>
      <p>
        Agradecemos tu interés en formar parte de NeuroAlert. Tras revisar tu solicitud, por ahora
        no podemos aprobarla por el siguiente motivo:
      </p>
      <p style="background:#fdf3f2;border-left:3px solid #b3261e;padding:12px 16px;border-radius:6px;color:#7a1c17">
        ${this.escapeHtml(reason)}
      </p>
      <p style="color:#666;font-size:14px">
        Si crees que se trata de un error o deseas más información, escríbenos a
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#0f4c47">${SUPPORT_EMAIL}</a>.
      </p>
    `);

    const text = `
Hola Dr(a). ${fullName},

Gracias por tu interés en NeuroAlert. Por ahora no podemos aprobar tu postulación.
Motivo: ${reason}

¿Dudas o crees que es un error? Escríbenos a ${SUPPORT_EMAIL}.
    `.trim();

    await this.send(to, subject, html, text);
  }

  // --------------------------------------------------------------------------
  // INFRAESTRUCTURA INTERNA
  // --------------------------------------------------------------------------
  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    const from = `${this.fromName} <${this.fromEmail}>`;

    // Fallback de desarrollo: imprime el enlace en los logs (no envía).
    if (this.provider === 'console') {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log(`📧 [SIMULADO] Correo a: ${to}`);
      this.logger.log(`📧 Asunto: ${subject}`);
      this.logger.log(`📧 Texto:`);
      this.logger.log(text);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    try {
      if (this.provider === 'brevo' && this.brevoApiKey) {
        // API HTTP de Brevo (puerto 443) — no la bloquea Render como al SMTP.
        // Timeout duro (AbortController) para que un envío lento no deje la conexión
        // colgada indefinidamente. Va en segundo plano, así que no afecta la UX.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': this.brevoApiKey,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: this.fromName, email: this.fromEmail },
              to: [{ email: to }],
              subject,
              htmlContent: html,
              textContent: text,
            }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => '');
            this.logger.error(
              `Brevo rechazó el correo a ${to}: HTTP ${res.status} ${detail.slice(0, 300)}`,
            );
            return; // No re-throw: un fallo de correo no debe tumbar el flujo principal
          }
          this.logger.log(`✉️  Correo enviado a ${to} vía Brevo (API HTTP)`);
          return;
        } finally {
          clearTimeout(timer);
        }
      }

      if (this.provider === 'smtp' && this.smtp) {
        const info = await this.smtp.sendMail({ from, to, subject, html, text });
        this.logger.log(`✉️  Correo enviado a ${to} vía SMTP (id: ${info.messageId})`);
        return;
      }

      if (this.provider === 'resend' && this.resend) {
        const { data, error } = await this.resend.emails.send({ from, to: [to], subject, html, text });
        if (error) {
          this.logger.error(`Error enviando correo a ${to}: ${error.message}`);
          return; // No re-throw: no bloquear el flujo principal
        }
        this.logger.log(`✉️  Correo enviado a ${to} vía Resend (id: ${data?.id})`);
      }
    } catch (err) {
      // Nunca propagamos: un fallo de correo no debe tumbar registro/login.
      this.logger.error(`Excepción enviando correo a ${to}: ${(err as Error).message}`);
    }
  }

  /**
   * Layout HTML mínimo para los correos.
   */
  private layout(content: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">
        <tr><td style="background:#0f4c47;padding:24px 32px">
          <h2 style="margin:0;color:#fff;font-size:20px;letter-spacing:-.01em">🧠 NeuroAlert</h2>
          <p style="margin:4px 0 0;color:#a3d4cf;font-size:13px">Detección temprana del TEA</p>
        </td></tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee">
          <p style="margin:0;color:#999;font-size:12px;text-align:center">
            NeuroAlert · Plataforma educativa sin fines diagnósticos<br>
            Para diagnóstico, consulta siempre con un profesional de la salud
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Escapa HTML para evitar inyección (defensa contra XSS en plantillas).
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
