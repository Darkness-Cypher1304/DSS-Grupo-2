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
