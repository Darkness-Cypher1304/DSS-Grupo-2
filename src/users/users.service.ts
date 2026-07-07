// ============================================================================
// UsersService
// ============================================================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, UserStatus, LeaveRequestStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  UpdateProfileDto,
  UpdateUserStatusDto,
  RequestAccountDeletionDto,
  RequestLeaveDto,
  LeaveDecisionDto,
} from './dto/users.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  private readonly graceDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.graceDays = parseInt(this.config.get('ACCOUNT_DELETION_GRACE_DAYS', '30'), 10);
  }

  // --------------------------------------------------------------------------
  // Perfil propio
  // --------------------------------------------------------------------------
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        specialistProfile: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Excluir campos sensibles ANTES de devolver
    const { passwordHash, emailVerificationToken, passwordResetToken, ...safe } = user;
    return safe;
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto, ip: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    await this.audit.log({
      userId,
      action: 'USER_ROLE_CHANGED', // sub-uso para "perfil actualizado"
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
      success: true,
      metadata: { fields: Object.keys(dto) },
    });

    const { passwordHash, emailVerificationToken, passwordResetToken, ...safe } = user;
    return safe;
  }

  // --------------------------------------------------------------------------
  // ADMIN: verificar el correo de un usuario manualmente (desbloquea el login
  // sin depender del envío de correo). Deja emailVerified=true y status=ACTIVE
  // de forma consistente (a diferencia de updateUserStatus, que solo toca status).
  // --------------------------------------------------------------------------
  async verifyUserEmail(targetUserId: string, adminId: string, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        emailVerified: true,
        status: UserStatus.ACTIVE,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'USER_EMAIL_VERIFIED',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: ip,
      success: true,
      metadata: { by: 'ADMIN' },
    });

    return { message: 'Usuario verificado y activado' };
  }

  // --------------------------------------------------------------------------
  // ADMIN: cambiar status (suspender/activar)
  // --------------------------------------------------------------------------
  async updateUserStatus(targetUserId: string, dto: UpdateUserStatusDto, adminId: string, ip: string) {
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: dto.status },
    });

    await this.audit.log({
      userId: adminId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: ip,
      success: true,
      metadata: { newStatus: dto.status },
    });

    return { message: 'Status actualizado' };
  }

  // --------------------------------------------------------------------------
  // ADMIN: listar usuarios paginado
  // --------------------------------------------------------------------------
  async listUsers(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: users,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ==========================================================================
  // CICLO DE VIDA DE CUENTA (Etapa 3)
  // ==========================================================================

  /**
   * PADRE: solicita eliminar su cuenta. Requiere reautenticación (contraseña).
   * Entra en período de gracia (PENDING_DELETION): no se borra ni anonimiza aún;
   * se revocan las sesiones y puede cancelar iniciando sesión antes de que venza.
   * Solo PARENT (el especialista solicita baja; admin no puede autoeliminarse).
   */
  async requestAccountDeletion(userId: string, dto: RequestAccountDeletionDto, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException(
        'Solo las cuentas de padre/apoderado pueden eliminarse directamente. Un especialista debe solicitar la baja.',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña incorrecta');

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + this.graceDays * DAY_MS);

    if (user.status === UserStatus.PENDING_DELETION) {
      return {
        message: 'Tu cuenta ya está programada para eliminación.',
        scheduledFor: user.deletionRequestedAt
          ? new Date(user.deletionRequestedAt.getTime() + this.graceDays * DAY_MS)
          : scheduledFor,
      };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.PENDING_DELETION,
        deletionRequestedAt: now,
        deletionReason: dto.reason ?? null,
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'ACCOUNT_DELETION_REQUESTED' },
    });

    await this.audit.log({
      userId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
      success: true,
      metadata: { event: 'ACCOUNT_DELETION_REQUESTED', graceDays: this.graceDays },
    });

    return {
      message:
        'Tu cuenta se eliminará al terminar el período de gracia. Puedes cancelar iniciando sesión de nuevo antes de esa fecha.',
      scheduledFor,
    };
  }

  /** PADRE: cancela la eliminación durante el período de gracia → vuelve a ACTIVE. */
  async cancelAccountDeletion(userId: string, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status !== UserStatus.PENDING_DELETION) {
      throw new BadRequestException('Tu cuenta no está en proceso de eliminación.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, deletionRequestedAt: null, deletionReason: null },
    });
    await this.audit.log({
      userId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
      success: true,
      metadata: { event: 'ACCOUNT_DELETION_CANCELLED' },
    });

    return { message: 'Cancelaste la eliminación. Tu cuenta sigue activa.' };
  }

  /**
   * ESPECIALISTA: solicita la baja (no elimina directamente). Crea/reabre una
   * SpecialistLeaveRequest en estado PENDING que revisa el admin.
   */
  async requestSpecialistLeave(userId: string, dto: RequestLeaveDto, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { leaveRequest: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.SPECIALIST) {
      throw new BadRequestException('Solo un especialista puede solicitar la baja.');
    }
    if (user.leaveRequest?.status === LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Ya tienes una solicitud de baja pendiente.');
    }

    await this.prisma.specialistLeaveRequest.upsert({
      where: { userId },
      update: {
        reason: dto.reason,
        comments: dto.comments,
        status: LeaveRequestStatus.PENDING,
        reviewedById: null,
        reviewedAt: null,
        decisionNote: null,
      },
      create: { userId, reason: dto.reason, comments: dto.comments },
    });

    await this.audit.log({
      userId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'SpecialistLeaveRequest',
      entityId: userId,
      ipAddress: ip,
      success: true,
      metadata: { event: 'SPECIALIST_LEAVE_REQUESTED', reason: dto.reason },
    });

    return { message: 'Solicitud de baja enviada. Un administrador la revisará.' };
  }

  /** ADMIN: solicitudes de baja pendientes (con datos del especialista). */
  async listLeaveRequests() {
    return this.prisma.specialistLeaveRequest.findMany({
      where: { status: LeaveRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true, createdAt: true } },
      },
    });
  }

  /**
   * ADMIN: aprueba la baja → la cuenta pasa a INACTIVE (NO se borra). Se revocan
   * sesiones; los artículos, el historial y la auditoría se conservan.
   */
  async approveLeaveRequest(id: string, adminId: string, dto: LeaveDecisionDto, ip: string) {
    const req = await this.prisma.specialistLeaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.specialistLeaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: now,
          decisionNote: dto.note ?? null,
        },
      }),
      this.prisma.user.update({ where: { id: req.userId }, data: { status: UserStatus.INACTIVE } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: req.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'SPECIALIST_LEAVE_APPROVED' },
      }),
    ]);

    await this.audit.log({
      userId: adminId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: req.userId,
      ipAddress: ip,
      success: true,
      metadata: { event: 'SPECIALIST_LEAVE_APPROVED', leaveRequestId: id },
    });

    return {
      message: 'Baja aprobada. La cuenta quedó inactiva; sus artículos e historial se conservan.',
    };
  }

  /** ADMIN: rechaza la solicitud de baja (con nota opcional). */
  async rejectLeaveRequest(id: string, adminId: string, dto: LeaveDecisionDto, ip: string) {
    const req = await this.prisma.specialistLeaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada.');
    }

    await this.prisma.specialistLeaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        decisionNote: dto.note ?? null,
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: req.userId,
      ipAddress: ip,
      success: true,
      metadata: { event: 'SPECIALIST_LEAVE_REJECTED', leaveRequestId: id },
    });

    return { message: 'Solicitud de baja rechazada.' };
  }

  /**
   * SISTEMA: anonimiza las cuentas cuyo período de gracia venció (PENDING_DELETION
   * con deletionRequestedAt anterior al corte). La PII se reemplaza por un
   * tombstone (email es @unique NOT NULL → no puede ser NULL); las evaluaciones,
   * consultas y auditoría se CONSERVAN (integridad histórica). Idempotente.
   * Se invoca desde POST /users/system/process-deletions (GitHub Actions programado).
   */
  async processExpiredDeletions(): Promise<{ processed: number }> {
    const cutoff = new Date(Date.now() - this.graceDays * DAY_MS);
    const expired = await this.prisma.user.findMany({
      where: {
        status: UserStatus.PENDING_DELETION,
        deletionRequestedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true },
    });

    let processed = 0;
    for (const u of expired) {
      const now = new Date();
      const placeholderHash = await bcrypt.hash(randomBytes(48).toString('hex'), 12);
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: u.id },
          data: {
            fullName: 'Usuario eliminado',
            email: `deleted-${u.id}@anonymized.local`,
            phoneNumber: null,
            passwordHash: placeholderHash,
            emailVerificationToken: null,
            passwordResetToken: null,
            deletedAt: now,
            anonymizedAt: now,
          },
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId: u.id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'ACCOUNT_ANONYMIZED' },
        }),
      ]);
      await this.audit.log({
        userId: null,
        action: 'USER_STATUS_CHANGED',
        entityType: 'User',
        entityId: u.id,
        ipAddress: 'system',
        success: true,
        metadata: { event: 'ACCOUNT_ANONYMIZED' },
      });
      processed++;
    }

    return { processed };
  }
}
