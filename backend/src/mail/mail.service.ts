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

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    this.fromName = this.config.get<string>('RESEND_FROM_NAME', 'NeuroAlert');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    if (apiKey && apiKey.trim().length > 0) {
      this.resend = new Resend(apiKey);
      this.enabled = true;
      this.logger.log('✅ Resend configurado — correos se enviarán por email');
    } else {
      this.resend = null;
      this.enabled = false;
      this.logger.warn(
        '⚠️  RESEND_API_KEY no configurada — correos se imprimirán en consola',
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
  // INFRAESTRUCTURA INTERNA
  // --------------------------------------------------------------------------
  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.enabled || !this.resend) {
      // Modo desarrollo sin Resend → imprime en consola
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log(`📧 [SIMULADO] Correo a: ${to}`);
      this.logger.log(`📧 Asunto: ${subject}`);
      this.logger.log(`📧 Texto:`);
      this.logger.log(text);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        this.logger.error(`Error enviando correo a ${to}: ${error.message}`);
        // No re-throw — fallar silenciosamente para no bloquear el flujo principal
        return;
      }

      this.logger.log(`✉️  Correo enviado a ${to} (id: ${data?.id})`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Excepción enviando correo: ${error.message}`);
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
