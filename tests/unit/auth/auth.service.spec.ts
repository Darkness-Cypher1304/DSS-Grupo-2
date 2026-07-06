// ============================================================================
// Unit · AuthService — registro, login (anti-enum/brute-force), refresh
// (rotación + reuse), verificación, reset, activación, cambio y sesiones.
// ============================================================================

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApplicationStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { AuthService } from '../../../src/auth/auth.service';
import { AuditService } from '../../../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { createRedisMock, RedisMock } from '../../mocks/redis.mock';
import { createMailMock, MailMock } from '../../mocks/mail.mock';
import { dbUser } from '../../fixtures/db-user.fixture';
import { USER_IDS } from '../../fixtures/users.fixture';

const STRONG = 'Zx9!vQ2#mLw7'; // no está en la blocklist
const IP = '1.2.3.4';
const UA = 'jest-agent';

const configMock = {
  get: (key: string, def?: unknown) => process.env[key] ?? def,
} as unknown as ConfigService;

describe('AuthService', () => {
  let prisma: PrismaMock;
  let redis: RedisMock;
  let mail: MailMock;
  let audit: { log: jest.Mock };
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    redis = createRedisMock();
    mail = createMailMock();
    audit = { log: jest.fn() };
    jwt = new JwtService();
    service = new AuthService(
      prisma,
      redis,
      jwt,
      configMock,
      mail,
      audit as unknown as AuditService,
    );
  });

  // ==========================================================================
  // REGISTER
  // ==========================================================================
  describe('register', () => {
    const dto = { email: 'nuevo@test.pe', password: STRONG, fullName: 'Nuevo' };

    it('rechaza contraseñas comunes/débiles (NIST)', async () => {
      await expect(
        service.register({ ...dto, password: 'password1234' }, IP, UA),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('crea el usuario, envía verificación y audita cuando el email es nuevo', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(dbUser({ id: 'u-new' }));

      const res = await service.register(dto, IP, UA);

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(mail.sendVerificationEmail).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_REGISTERED' }),
      );
      expect(res.message).toMatch(/verificaci/i);
    });

    it('con email ya PENDING_VERIFICATION reenvía verificación SIN crear ni tocar contraseña', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', status: UserStatus.PENDING_VERIFICATION }),
      );

      await service.register(dto, IP, UA);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mail.sendVerificationEmail).toHaveBeenCalled();
    });

    it('con email ya ACTIVO no crea ni reenvía (mensaje genérico anti-enumeración)', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ status: UserStatus.ACTIVE }));

      const res = await service.register(dto, IP, UA);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(res.message).toMatch(/verificaci/i);
    });
  });

  // ==========================================================================
  // LOGIN
  // ==========================================================================
  describe('login', () => {
    async function activeUserWithPassword(pwd: string, overrides = {}) {
      return dbUser({ passwordHash: await bcrypt.hash(pwd, 4), status: UserStatus.ACTIVE, ...overrides });
    }

    it('inicia sesión y emite tokens con credenciales válidas', async () => {
      const user = await activeUserWithPassword(STRONG);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' } as never);

      const res = await service.login({ email: user.email, password: STRONG }, IP, UA);

      expect(res.accessToken).toBeTruthy();
      expect(res.refreshToken).toBeTruthy();
      expect(res.user.email).toBe(user.email);
      expect(redis.resetFailedLogin).toHaveBeenCalledWith(user.email);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_LOGIN_SUCCESS' }),
      );
    });

    it('rechaza si la cuenta está bloqueada temporalmente', async () => {
      const user = await activeUserWithPassword(STRONG, {
        lockedUntil: new Date(Date.now() + 60_000),
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: STRONG }, IP, UA),
      ).rejects.toThrow(/bloqueada/i);
    });

    it('con contraseña inválida incrementa el contador y bloquea al alcanzar el máximo', async () => {
      const user = await activeUserWithPassword(STRONG, { failedLoginAttempts: 4 });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'incorrecta' }, IP, UA),
      ).rejects.toThrow('Credenciales inválidas');

      const updateArg = prisma.user.update.mock.calls[0][0];
      expect(updateArg.data.failedLoginAttempts).toBe(5);
      expect(updateArg.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('con usuario inexistente responde genérico (anti-enumeración) sin update', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nadie@test.pe', password: STRONG }, IP, UA),
      ).rejects.toThrow('Credenciales inválidas');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it.each([
      [UserStatus.PENDING_VERIFICATION, /verificar tu correo/i],
      [UserStatus.INACTIVE, /inactiva/i],
      [UserStatus.DISABLED, /deshabilitada/i],
      [UserStatus.SUSPENDED, /suspendida/i],
    ])('rechaza el login si el estado es %s', async (status, msg) => {
      const user = await activeUserWithPassword(STRONG, { status });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: STRONG }, IP, UA),
      ).rejects.toThrow(msg);
    });

    it('rechaza (genérico) si la cuenta fue eliminada/anonimizada', async () => {
      const user = await activeUserWithPassword(STRONG, { deletedAt: new Date() });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: STRONG }, IP, UA),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  // ==========================================================================
  // REFRESH (rotación + detección de reuse)
  // ==========================================================================
  describe('refresh', () => {
    async function signRefresh(sub: string) {
      return jwt.signAsync(
        { sub, email: 'x@test.pe', role: 'PARENT', jti: 'j' },
        { secret: process.env.JWT_REFRESH_SECRET },
      );
    }

    it('rechaza si no se envía refresh token', async () => {
      await expect(service.refresh('', IP, UA)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un refresh token con firma inválida', async () => {
      await expect(service.refresh('no-es-un-jwt', IP, UA)).rejects.toThrow(
        /inválido o expirado/i,
      );
    });

    it('rota el token y emite uno nuevo en la misma familia', async () => {
      const token = await signRefresh(USER_IDS.parent);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: USER_IDS.parent,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        family: 'fam-1',
      } as never);
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: USER_IDS.parent, status: UserStatus.ACTIVE }));
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt2' } as never);

      const res = await service.refresh(token, IP, UA);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedReason: 'ROTATED' }) }),
      );
      expect(res.accessToken).toBeTruthy();
    });

    it('detecta reuse de un token ya revocado y revoca toda la familia', async () => {
      const token = await signRefresh(USER_IDS.parent);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: USER_IDS.parent,
        revokedAt: new Date(),
        family: 'fam-1',
      } as never);

      await expect(service.refresh(token, IP, UA)).rejects.toThrow(/comprometido/i);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedReason: 'POTENTIAL_REUSE_DETECTED' }),
        }),
      );
    });

    it('rechaza si el token no corresponde al usuario del payload', async () => {
      const token = await signRefresh(USER_IDS.parent);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'otro-user',
        revokedAt: null,
      } as never);

      await expect(service.refresh(token, IP, UA)).rejects.toThrow(/no encontrado/i);
    });
  });

  // ==========================================================================
  // LOGOUT
  // ==========================================================================
  describe('logout', () => {
    it('pone el access token en blacklist y revoca el refresh presentado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: USER_IDS.parent,
        revokedAt: null,
      } as never);

      await service.logout(USER_IDS.parent, 'jti-1', 'sometoken');

      expect(redis.blacklistJwt).toHaveBeenCalledWith('jti-1', expect.any(Number));
      expect(prisma.refreshToken.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGOUT' }));
    });
  });

  // ==========================================================================
  // VERIFY EMAIL
  // ==========================================================================
  describe('verifyEmail', () => {
    const token = 'a'.repeat(64);

    it('rechaza tokens demasiado cortos', async () => {
      await expect(service.verifyEmail('corto')).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el token no corresponde a ningún usuario', async () => {
      redis.getEmailVerificationUser.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail(token)).rejects.toThrow(/inválido o expirado/i);
    });

    it('rechaza si el token de verificación expiró', async () => {
      redis.getEmailVerificationUser.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ emailVerificationExpiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.verifyEmail(token)).rejects.toThrow(/expirado/i);
    });

    it('verifica el email y activa la cuenta', async () => {
      redis.getEmailVerificationUser.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', emailVerificationExpiresAt: new Date(Date.now() + 60_000) }),
      );

      const res = await service.verifyEmail(token);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: true, status: UserStatus.ACTIVE }),
        }),
      );
      expect(res.message).toMatch(/verificado/i);
    });
  });

  // ==========================================================================
  // RESET PASSWORD
  // ==========================================================================
  describe('resetPassword', () => {
    it('rechaza si el token es inválido o expiró', async () => {
      redis.getPasswordResetUser.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'x', newPassword: STRONG }),
      ).rejects.toThrow(/inválido o expirado/i);
    });

    it('rechaza si la nueva contraseña es igual a la actual', async () => {
      redis.getPasswordResetUser.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ passwordHash: await bcrypt.hash(STRONG, 4), passwordResetExpiresAt: new Date(Date.now() + 60_000) }),
      );

      await expect(
        service.resetPassword({ token: 'x', newPassword: STRONG }),
      ).rejects.toThrow(/diferente/i);
    });

    it('actualiza la contraseña y revoca todas las sesiones', async () => {
      redis.getPasswordResetUser.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', passwordHash: await bcrypt.hash('OtraVieja#123', 4), passwordResetExpiresAt: new Date(Date.now() + 60_000) }),
      );

      const res = await service.resetPassword({ token: 'x', newPassword: STRONG });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedReason: 'PASSWORD_RESET' }) }),
      );
      expect(res.message).toMatch(/actualizada/i);
    });
  });

  // ==========================================================================
  // ACTIVATE SPECIALIST
  // ==========================================================================
  describe('activateSpecialist', () => {
    it('rechaza si la postulación no es válida/aprobada', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue(null);

      await expect(service.activateSpecialist('tok', STRONG)).rejects.toThrow(/inválido/i);
    });

    it('activa la cuenta y consume el token en una transacción', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue({
        id: 'app1',
        status: ApplicationStatus.APPROVED,
        createdUserId: 'u1',
        activationExpiresAt: new Date(Date.now() + 60_000),
      } as never);
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: 'u1', status: UserStatus.PENDING_VERIFICATION }));

      const res = await service.activateSpecialist('tok', STRONG);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.message).toMatch(/activada/i);
    });

    it('rechaza si la cuenta ya está activa', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue({
        id: 'app1',
        status: ApplicationStatus.APPROVED,
        createdUserId: 'u1',
        activationExpiresAt: new Date(Date.now() + 60_000),
      } as never);
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: 'u1', status: UserStatus.ACTIVE }));

      await expect(service.activateSpecialist('tok', STRONG)).rejects.toThrow(/ya está activada/i);
    });
  });

  // ==========================================================================
  // CHANGE PASSWORD
  // ==========================================================================
  describe('changePassword', () => {
    it('rechaza si la contraseña actual es incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ passwordHash: await bcrypt.hash('Actual#123', 4) }));

      await expect(
        service.changePassword(USER_IDS.parent, { currentPassword: 'malísima', newPassword: STRONG }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('cambia la contraseña con la actual correcta', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: 'u1', passwordHash: await bcrypt.hash('Actual#123', 4) }));

      const res = await service.changePassword('u1', {
        currentPassword: 'Actual#123',
        newPassword: STRONG,
      });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(res.message).toMatch(/actualizada/i);
    });
  });

  // ==========================================================================
  // SESIONES
  // ==========================================================================
  describe('sesiones', () => {
    it('lista sesiones y marca la actual por hash', async () => {
      const currentToken = 'refresh-actual';
      // el servicio hashea internamente; usamos el mismo algoritmo esperado
      const { createHash } = await import('crypto');
      const currentHash = createHash('sha256').update(currentToken).digest('hex');

      prisma.refreshToken.findMany.mockResolvedValue([
        { id: 's1', ipAddress: IP, userAgent: UA, createdAt: new Date(), expiresAt: new Date(), tokenHash: currentHash },
        { id: 's2', ipAddress: IP, userAgent: UA, createdAt: new Date(), expiresAt: new Date(), tokenHash: 'otro' },
      ] as never);

      const sessions = await service.listSessions(USER_IDS.parent, currentToken);

      expect(sessions.find((s) => s.id === 's1')?.isCurrent).toBe(true);
      expect(sessions.find((s) => s.id === 's2')?.isCurrent).toBe(false);
    });

    it('revokeSession lanza 404 si la sesión no es del usuario', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 's1', userId: 'otro' } as never);

      await expect(service.revokeSession(USER_IDS.parent, 's1')).rejects.toThrow(NotFoundException);
    });

    it('revokeAllSessions revoca y pone el access actual en blacklist', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 } as never);

      const res = await service.revokeAllSessions(USER_IDS.parent, 'jti-actual');

      expect(res.revoked).toBe(3);
      expect(redis.blacklistJwt).toHaveBeenCalledWith('jti-actual', expect.any(Number));
    });
  });
});
