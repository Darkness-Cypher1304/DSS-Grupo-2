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
  Get,
  HttpCode,
  HttpStatus,
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
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
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
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
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

  // ==========================================================================
  // HELPERS PRIVADOS — Cookie HttpOnly para refresh token
  // ==========================================================================
  private setRefreshCookie(res: Response, refreshToken: string): void {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const secureCookie = this.config.get('COOKIE_SECURE', 'false') === 'true' || isProd;

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,            // JS no puede leerla → previene XSS
      secure: secureCookie,      // Solo HTTPS en prod
      sameSite: 'strict',        // Previene CSRF
      path: '/api/auth',         // limitada a auth endpoints
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      signed: true,              // firma con cookie-parser
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  }
}
