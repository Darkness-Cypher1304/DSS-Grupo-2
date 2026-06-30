// ============================================================================
// AuthController
// ============================================================================
// Endpoints públicos (registro, login, etc.) y autenticados (logout, change pwd).
// El refresh token se maneja en cookies HttpOnly + Secure + SameSite=strict.
// Rate limit reforzado en endpoints sensibles via @Throttle.
// ============================================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { Public, CurrentUser, ClientIp, AuthUser } from '../common/decorators';

const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // --------------------------------------------------------------------------
  // POST /auth/register — Registro de nuevo padre
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 registros/min por IP
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo padre/cuidador' })
  @ApiResponse({ status: 201, description: 'Cuenta creada, email enviado' })
  async register(
    @Body() dto: RegisterDto,
    @ClientIp() ip: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.register(dto, ip, userAgent);
  }

  // --------------------------------------------------------------------------
  // POST /auth/login
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 logins/min por IP
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(
    @Body() dto: LoginDto,
    @ClientIp() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const result = await this.authService.login(dto, ip, userAgent);

    this.setRefreshCookie(res, result.refreshToken);

    // Devolvemos accessToken en body, refresh va en cookie HttpOnly
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  // --------------------------------------------------------------------------
  // POST /auth/refresh — Renovar access token usando refresh cookie
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  async refresh(
    @Req() req: Request,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // La cookie se emite con `signed: true`, por lo que cookie-parser la coloca
    // en `req.signedCookies` (NO en `req.cookies`). Leer de `req.cookies` aquí
    // devolvía siempre undefined → el refresh fallaba y la sesión no persistía.
    const refreshToken = (req.signedCookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.refresh(refreshToken!, ip, userAgent);

    this.setRefreshCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  // --------------------------------------------------------------------------
  // POST /auth/logout
  // --------------------------------------------------------------------------
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = (req.signedCookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(user.sub, user.jti, refreshToken);

    this.clearRefreshCookie(res);

    return { message: 'Sesión cerrada correctamente' };
  }

  // --------------------------------------------------------------------------
  // POST /auth/verify-email
  // --------------------------------------------------------------------------
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar email con token recibido' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(dto.token);
  }

  // --------------------------------------------------------------------------
  // POST /auth/resend-verification — reenviar correo de verificación
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 solicitudes/min por IP
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  @ApiOperation({ summary: 'Reenviar correo de verificación a una cuenta sin verificar' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
    return this.authService.resendVerification(dto.email);
  }

  // --------------------------------------------------------------------------
  // POST /auth/forgot-password
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 solicitudes/min por IP
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar correo de reseteo de contraseña' })
  async forgotPassword(@Body() dto: RequestPasswordResetDto): Promise<{ message: string }> {
    return this.authService.requestPasswordReset(dto.email);
  }

  // --------------------------------------------------------------------------
  // POST /auth/reset-password
  // --------------------------------------------------------------------------
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Resetear contraseña con token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  // --------------------------------------------------------------------------
  // POST /auth/change-password (autenticado)
  // --------------------------------------------------------------------------
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiOperation({ summary: 'Cambiar contraseña (usuario autenticado)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.sub, dto);
  }

  // --------------------------------------------------------------------------
  // GET /auth/me (autenticado) — info básica del usuario actual
  // --------------------------------------------------------------------------
  @Get('me')
  @ApiOperation({ summary: 'Datos del usuario actual' })
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
  }

  // --------------------------------------------------------------------------
  // GET /auth/sessions — listar sesiones activas (dispositivos) del usuario
  // --------------------------------------------------------------------------
  @Get('sessions')
  @ApiOperation({ summary: 'Listar sesiones activas del usuario (dispositivos)' })
  listSessions(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const refreshToken = (req.signedCookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    return this.authService.listSessions(user.sub, refreshToken);
  }

  // --------------------------------------------------------------------------
  // DELETE /auth/sessions/:id — cerrar una sesión específica
  // --------------------------------------------------------------------------
  @HttpCode(HttpStatus.OK)
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Cerrar una sesión específica (revocar ese dispositivo)' })
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeSession(user.sub, id);
  }

  // --------------------------------------------------------------------------
  // POST /auth/sessions/revoke-all — cerrar sesión en TODOS los dispositivos
  // --------------------------------------------------------------------------
  @HttpCode(HttpStatus.OK)
  @Post('sessions/revoke-all')
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos' })
  async revokeAllSessions(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: number; message: string }> {
    const result = await this.authService.revokeAllSessions(user.sub, user.jti);

    // La sesión actual también queda cerrada → limpiar su cookie de refresh.
    this.clearRefreshCookie(res);

    return { revoked: result.revoked, message: 'Sesión cerrada en todos los dispositivos' };
  }

  // ==========================================================================
  // HELPERS PRIVADOS — Cookie HttpOnly para refresh token
  // ==========================================================================
  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.refreshCookieBaseOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      signed: true, // firma con cookie-parser
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.refreshCookieBaseOptions());
  }

  /**
   * Opciones base de la cookie de refresh, configurables por entorno.
   * En producción el frontend y el backend viven en subdominios distintos de
   * onrender.com (cross-site) → se necesita SameSite=None + Secure + domain.
   * En local, Strict basta. Se leen de COOKIE_SAMESITE / COOKIE_DOMAIN /
   * COOKIE_SECURE (definidas en render.yaml).
   */
  private refreshCookieBaseOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path: string;
  } {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const sameSite = this.config
      .get<string>('COOKIE_SAMESITE', 'strict')
      .toLowerCase() as 'strict' | 'lax' | 'none';
    // Regla del navegador: SameSite=None EXIGE Secure=true.
    const secure =
      this.config.get('COOKIE_SECURE', 'false') === 'true' || isProd || sameSite === 'none';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;

    return {
      httpOnly: true, // JS no puede leerla → previene XSS
      secure, // solo HTTPS
      sameSite, // CSRF: strict en local, none en prod cross-site
      domain, // p.ej. .onrender.com en prod
      path: '/api/auth', // limitada a los endpoints de auth
    };
  }
}
