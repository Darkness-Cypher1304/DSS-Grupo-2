// ============================================================================
// AuthService
// ============================================================================
// Lógica completa de autenticación. Implementa:
//   - Registro con verificación de email
//   - Login con anti-brute-force (failed attempts + lockout)
//   - JWT access (15min) + refresh (7d) con rotación
//   - Logout con blacklist en Redis
//   - Recuperación de contraseña con token de un solo uso
//   - Cambio de contraseña con verificación de actual
//   - Audit log de cada acción crítica
// ============================================================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { User, UserRole, UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../config/redis.module';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
}

interface LoginResult {
  user: { id: string; email: string; fullName: string; role: UserRole; emailVerified: boolean };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;
  private readonly maxLoginAttempts: number;
  private readonly lockoutDurationSec: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {
    this.bcryptRounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
    this.maxLoginAttempts = parseInt(this.config.get('MAX_LOGIN_ATTEMPTS', '5'), 10);
    this.lockoutDurationSec = parseInt(this.config.get('LOGIN_LOCKOUT_DURATION', '900'), 10);
  }

  // ==========================================================================
  // REGISTRO
  // ==========================================================================
  async register(dto: RegisterDto, ip: string, userAgent: string): Promise<{ message: string }> {
    // Mensaje ÚNICO de respuesta (idéntico exista o no la cuenta) — anti-enumeración
    // (OWASP A07): el cliente NO puede distinguir un email nuevo de uno ya registrado.
    const genericRegisterMessage = {
      message:
        'Te enviamos un correo de verificación. Revisa tu bandeja de entrada y la carpeta de spam.',
    };

    // Verificar si el email ya existe (sin revelarlo en el error)
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, fullName: true, status: true },
    });

    if (existing) {
      // No revelamos que el email ya existe. PERO si la cuenta sigue SIN verificar,
      // REENVIAMOS el correo de verificación: un correo perdido no debe dejar al
      // usuario en un callejón sin salida (no podía verificar → no podía entrar →
      // re-registrarse no hacía nada). NO se toca la contraseña ni ningún otro dato
      // de la cuenta existente (evita que un tercero altere cuentas ajenas).
      if (existing.status === UserStatus.PENDING_VERIFICATION) {
        const verificationToken = randomBytes(32).toString('hex');
        const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            emailVerificationToken: verificationToken,
            emailVerificationExpiresAt: verificationExpiresAt,
          },
        });
        await this.redis.storeEmailVerificationToken(verificationToken, existing.id);
        await this.mail.sendVerificationEmail(existing.email, existing.fullName, verificationToken);
        this.logger.warn(`Re-registro de cuenta sin verificar — reenviando verificación: ${dto.email}`);
      } else {
        this.logger.warn(`Intento de registro con email ya registrado/activo: ${dto.email}`);
      }
      return genericRegisterMessage;
    }

    // ----------------------------------------------------------------------
    // Hash de contraseña con bcrypt rounds=12 (recomendación OWASP 2024+)
    // ----------------------------------------------------------------------
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    // ----------------------------------------------------------------------
    // Token de verificación de email (32 bytes = 256 bits aleatorios)
    // ----------------------------------------------------------------------
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // ----------------------------------------------------------------------
    // Crear usuario (rol = PARENT por defecto, status = PENDING_VERIFICATION)
    // ----------------------------------------------------------------------
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        role: UserRole.PARENT, // mass assignment prevention: NUNCA del cliente
        status: UserStatus.PENDING_VERIFICATION,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
    });

    // Backup del token también en Redis (TTL 1h, una capa más)
    await this.redis.storeEmailVerificationToken(verificationToken, user.id);

    // ----------------------------------------------------------------------
    // Enviar correo de verificación
    // ----------------------------------------------------------------------
    await this.mail.sendVerificationEmail(user.email, user.fullName, verificationToken);

    // ----------------------------------------------------------------------
    // Audit log
    // ----------------------------------------------------------------------
    await this.audit.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
      success: true,
    });

    return genericRegisterMessage;
  }

  // ==========================================================================
  // LOGIN
  // ==========================================================================
  async login(dto: LoginDto, ip: string, userAgent: string): Promise<LoginResult> {
    // ----------------------------------------------------------------------
    // 1) Defensa contra enumeración: timing attack-safe
    //    Aunque el usuario no exista, ejecutamos un bcrypt dummy.
    // ----------------------------------------------------------------------
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // ----------------------------------------------------------------------
    // 2) Bloqueo si demasiados intentos fallidos
    // ----------------------------------------------------------------------
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordFailedAttempt(dto.email, ip, userAgent, 'ACCOUNT_LOCKED');
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intenta de nuevo en unos minutos.`,
      );
    }

    // ----------------------------------------------------------------------
    // 3) Validación de password (timing-safe incluso si user no existe)
    // ----------------------------------------------------------------------
    const dummyHash = '$2b$12$DummyHashForTimingAttackPreventionXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const passwordHash = user?.passwordHash || dummyHash;
    const passwordValid = await bcrypt.compare(dto.password, passwordHash);

    // Si user no existe O password inválida → fallido
    if (!user || !passwordValid) {
      await this.recordFailedAttempt(
        dto.email,
        ip,
        userAgent,
        user ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND',
      );

      // Si el usuario sí existe, sumamos su contador
      if (user) {
        const newFailCount = user.failedLoginAttempts + 1;
        const updates: { failedLoginAttempts: number; lockedUntil?: Date } = {
          failedLoginAttempts: newFailCount,
        };

        if (newFailCount >= this.maxLoginAttempts) {
          updates.lockedUntil = new Date(Date.now() + this.lockoutDurationSec * 1000);
          this.logger.warn(`Usuario ${user.email} bloqueado tras ${newFailCount} intentos`);
        }

        await this.prisma.user.update({ where: { id: user.id }, data: updates });
      }

      // Mensaje genérico — no revelamos si fue user no existente o pass inválida
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // ----------------------------------------------------------------------
    // 4) Verificar estado de la cuenta
    // ----------------------------------------------------------------------
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Cuenta suspendida. Contacta al administrador.');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException(
        'Debes verificar tu correo electrónico antes de iniciar sesión.',
      );
    }

    // ----------------------------------------------------------------------
    // 5) Login exitoso — limpiar contadores, actualizar últimos datos
    // ----------------------------------------------------------------------
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });
    await this.redis.resetFailedLogin(dto.email);

    // ----------------------------------------------------------------------
    // 6) Emitir tokens
    // ----------------------------------------------------------------------
    const tokens = await this.issueTokens(user, ip, userAgent);

    await this.audit.log({
      userId: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
      success: true,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ==========================================================================
  // REFRESH TOKEN — con rotación
  // ==========================================================================
  async refresh(refreshToken: string, ip: string, userAgent: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    // 1) Verificar firma + expiración del refresh
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // 2) Localizar el registro que corresponde EXACTAMENTE al token presentado.
    //    Se busca por igualdad de hash SHA-256 (determinista, sin sal). Antes se
    //    usaba bcrypt, pero bcrypt trunca la entrada a 72 bytes y un refresh JWT
    //    es mucho más largo: los primeros 72 bytes (header + inicio del claim
    //    `sub`) son IDÉNTICOS entre todos los tokens del mismo usuario, así que
    //    cualquier token "coincidía" con cualquier hash → la revocación y la
    //    detección de reuse no funcionaban. SHA-256 vincula al token exacto.
    const tokenHash = this.hashToken(refreshToken);
    const matched = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Token no reconocido (o de otro usuario) → inválido
    if (!matched || matched.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    // Token YA revocado → posible reuse attack: revocamos toda la familia
    if (matched.revokedAt) {
      this.logger.warn(
        `Reuse de refresh token revocado para userId=${payload.sub} family=${matched.family}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: matched.family, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'POTENTIAL_REUSE_DETECTED' },
      });
      throw new UnauthorizedException('Token comprometido — sesión revocada');
    }

    // Token expirado en BD (defensa extra además de la verificación de firma)
    if (matched.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // 3) Cargar usuario
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    // 4) Revocar el refresh presentado y emitir uno nuevo en la misma familia
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
    });

    const tokens = await this.issueTokens(user, ip, userAgent, matched.family);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ==========================================================================
  // LOGOUT
  // ==========================================================================
  async logout(userId: string, jti: string, refreshToken?: string): Promise<void> {
    // 1) Blacklist del access token (TTL = vida restante del access ~15min)
    const accessTtl = parseInt(this.config.get('JWT_ACCESS_EXPIRATION_SECONDS', '900'), 10);
    await this.redis.blacklistJwt(jti, accessTtl);

    // 2) Revocar refresh token (si vino) — búsqueda exacta por hash SHA-256
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (stored && stored.userId === userId && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
        });
      }
    }

    await this.audit.log({
      userId,
      action: 'USER_LOGOUT',
      ipAddress: 'unknown',
      success: true,
    });
  }

  // ==========================================================================
  // VERIFICAR EMAIL
  // ==========================================================================
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token || token.length < 32) {
      throw new BadRequestException('Token inválido');
    }

    // Buscar en Redis primero (más rápido)
    const userIdFromRedis = await this.redis.getEmailVerificationUser(token);

    const user = userIdFromRedis
      ? await this.prisma.user.findUnique({ where: { id: userIdFromRedis } })
      : await this.prisma.user.findUnique({ where: { emailVerificationToken: token } });

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Token expirado. Solicita uno nuevo.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: UserStatus.ACTIVE,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    await this.redis.deleteEmailVerificationToken(token);

    await this.audit.log({
      userId: user.id,
      action: 'USER_EMAIL_VERIFIED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: 'unknown',
      success: true,
    });

    return { message: 'Email verificado exitosamente. Ya puedes iniciar sesión.' };
  }

  // ==========================================================================
  // SOLICITAR RESET DE CONTRASEÑA
  // ==========================================================================
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Mensaje genérico independientemente de si el email existe
    const genericMessage = {
      message: 'Si la cuenta existe, te enviamos un correo con instrucciones.',
    };

    if (!user) return genericMessage;

    const resetToken = randomBytes(32).toString('hex');
    const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpiresAt,
      },
    });

    await this.redis.storePasswordResetToken(resetToken, user.id);
    await this.mail.sendPasswordResetEmail(user.email, user.fullName, resetToken);

    return genericMessage;
  }

  // ==========================================================================
  // RESETEAR CONTRASEÑA
  // ==========================================================================
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userIdFromRedis = await this.redis.getPasswordResetUser(dto.token);

    const user = userIdFromRedis
      ? await this.prisma.user.findUnique({ where: { id: userIdFromRedis } })
      : await this.prisma.user.findUnique({ where: { passwordResetToken: dto.token } });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.redis.deletePasswordResetToken(dto.token);

    // Revocar TODOS los refresh tokens del usuario (defensa: si la cuenta
    // estaba comprometida, esto cierra todas las sesiones activas).
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
    });

    await this.audit.log({
      userId: user.id,
      action: 'USER_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: 'unknown',
      success: true,
    });

    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  // ==========================================================================
  // CAMBIAR CONTRASEÑA (usuario autenticado)
  // ==========================================================================
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      userId,
      action: 'USER_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress: 'unknown',
      success: true,
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  // ==========================================================================
  // SESIONES ACTIVAS (dispositivos)
  // ==========================================================================
  /**
   * Lista las sesiones activas (refresh tokens vigentes) del usuario.
   * Marca cuál es la sesión actual comparando el hash SHA-256 del refresh
   * token presentado en la cookie. NUNCA devuelve el hash del token.
   */
  async listSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;

    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        tokenHash: true,
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentHash !== null && s.tokenHash === currentHash,
    }));
  }

  /**
   * Cierra una sesión específica del usuario (revoca su refresh token).
   * Solo el dueño puede hacerlo; devuelve 404 si la sesión no es suya
   * (no revelamos existencia de sesiones ajenas).
   */
  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Sesión no encontrada');
    }

    if (!session.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), revokedReason: 'USER_REVOKED_SESSION' },
      });
    }

    await this.audit.log({
      userId,
      action: 'USER_LOGOUT',
      entityType: 'RefreshToken',
      entityId: sessionId,
      ipAddress: 'unknown',
      success: true,
      metadata: { event: 'session_revoked' },
    });

    return { message: 'Sesión cerrada' };
  }

  /**
   * Cierra la sesión en TODOS los dispositivos: revoca todos los refresh tokens
   * del usuario y pone el access token actual en la blacklist de Redis para que
   * la invalidación sea inmediata (los demás dispositivos no podrán renovar y
   * caen al expirar el access ~15 min).
   */
  async revokeAllSessions(userId: string, currentJti?: string): Promise<{ revoked: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'USER_REVOKED_ALL' },
    });

    if (currentJti) {
      const accessTtl = parseInt(this.config.get('JWT_ACCESS_EXPIRATION_SECONDS', '900'), 10);
      await this.redis.blacklistJwt(currentJti, accessTtl);
    }

    await this.audit.log({
      userId,
      action: 'USER_LOGOUT',
      entityType: 'RefreshToken',
      ipAddress: 'unknown',
      success: true,
      metadata: { event: 'revoke_all_sessions', revoked: result.count },
    });

    return { revoked: result.count };
  }

  // ==========================================================================
  // HELPERS PRIVADOS
  // ==========================================================================
  private async issueTokens(
    user: User,
    ip: string,
    userAgent: string,
    family?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = randomUUID();
    const tokenFamily = family || randomUUID();

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRATION', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      issuer: this.config.get<string>('JWT_ISSUER', 'neuroalert'),
      audience: this.config.get<string>('JWT_AUDIENCE', 'neuroalert-users'),
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, jti: randomUUID() },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        issuer: this.config.get<string>('JWT_ISSUER', 'neuroalert'),
        audience: this.config.get<string>('JWT_AUDIENCE', 'neuroalert-users'),
      },
    );

    // Guardar HASH del refresh token en BD (SHA-256: determinista y sin truncar,
    // a diferencia de bcrypt que recorta a 72 bytes). Permite búsqueda exacta
    // por el índice @unique de tokenHash y revocación fiable por-token.
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family: tokenFamily,
        ipAddress: ip,
        userAgent,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async recordFailedAttempt(
    email: string,
    ip: string,
    userAgent: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.failedLoginAttempt.create({
      data: { email, ipAddress: ip, userAgent, reason },
    });

    await this.redis.incrementFailedLogin(email);

    await this.audit.log({
      action: 'USER_LOGIN_FAILED',
      ipAddress: ip,
      userAgent,
      success: false,
      metadata: { email, reason },
    });
  }

  /**
   * Hash determinista (SHA-256) del refresh token para almacenarlo y buscarlo
   * por igualdad exacta. Apropiado porque el token es de alta entropía (JWT
   * firmado); no se usa bcrypt porque trunca a 72 bytes y rompe la unicidad.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
