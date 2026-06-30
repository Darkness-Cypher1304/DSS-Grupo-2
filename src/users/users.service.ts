// ============================================================================
// UsersService
// ============================================================================

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus, SpecialistVerificationStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  UpdateProfileDto,
  UpdateUserStatusDto,
  RequestSpecialistUpgradeDto,
  VerifySpecialistDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
  // Solicitar upgrade a SPECIALIST
  // --------------------------------------------------------------------------
  async requestSpecialistUpgrade(userId: string, dto: RequestSpecialistUpgradeDto, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { specialistProfile: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === UserRole.SPECIALIST && user.specialistProfile?.verificationStatus === 'APPROVED') {
      throw new BadRequestException('Ya eres especialista verificado');
    }

    // Crear o actualizar el SpecialistProfile en estado PENDING
    const profile = await this.prisma.specialistProfile.upsert({
      where: { userId },
      update: {
        licenseNumber: dto.licenseNumber,
        specialty: dto.specialty,
        institution: dto.institution,
        yearsOfExperience: dto.yearsOfExperience,
        bio: dto.bio,
        // RF-10: documentos de validación (IDs de FileObject). Solo se sobreescriben
        // si llegan en la solicitud (undefined = Prisma no toca el campo).
        licenseDocumentKey: dto.licenseDocumentId ?? undefined,
        cvDocumentKey: dto.cvDocumentId ?? undefined,
        verificationStatus: SpecialistVerificationStatus.PENDING,
        rejectionReason: null,
      },
      create: {
        userId,
        licenseNumber: dto.licenseNumber,
        specialty: dto.specialty,
        institution: dto.institution,
        yearsOfExperience: dto.yearsOfExperience,
        bio: dto.bio,
        licenseDocumentKey: dto.licenseDocumentId ?? undefined,
        cvDocumentKey: dto.cvDocumentId ?? undefined,
        verificationStatus: SpecialistVerificationStatus.PENDING,
      },
    });

    await this.audit.log({
      userId,
      action: 'USER_ROLE_CHANGED',
      entityType: 'SpecialistProfile',
      entityId: profile.id,
      ipAddress: ip,
      success: true,
      metadata: { request: 'SPECIALIST_UPGRADE_REQUESTED' },
    });

    return { message: 'Solicitud enviada. Un administrador revisará tu información.' };
  }

  // --------------------------------------------------------------------------
  // ADMIN: listar especialistas pendientes de verificación
  // --------------------------------------------------------------------------
  async listPendingSpecialists() {
    return this.prisma.specialistProfile.findMany({
      where: { verificationStatus: SpecialistVerificationStatus.PENDING },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phoneNumber: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --------------------------------------------------------------------------
  // ADMIN: aprobar/rechazar especialista
  // --------------------------------------------------------------------------
  async verifySpecialist(
    profileId: string,
    adminId: string,
    dto: VerifySpecialistDto,
    ip: string,
  ) {
    const profile = await this.prisma.specialistProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Perfil no encontrado');

    if (dto.decision === 'APPROVED') {
      await this.prisma.$transaction([
        this.prisma.specialistProfile.update({
          where: { id: profileId },
          data: {
            verificationStatus: SpecialistVerificationStatus.APPROVED,
            verifiedAt: new Date(),
            verifiedById: adminId,
            rejectionReason: null,
          },
        }),
        this.prisma.user.update({
          where: { id: profile.userId },
          data: { role: UserRole.SPECIALIST },
        }),
      ]);

      await this.audit.log({
        userId: adminId,
        action: 'SPECIALIST_VERIFIED',
        entityType: 'SpecialistProfile',
        entityId: profileId,
        ipAddress: ip,
        success: true,
      });

      return { message: 'Especialista aprobado y rol actualizado' };
    }

    // REJECTED
    await this.prisma.specialistProfile.update({
      where: { id: profileId },
      data: {
        verificationStatus: SpecialistVerificationStatus.REJECTED,
        rejectionReason: dto.rejectionReason || 'Sin razón especificada',
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'SPECIALIST_REJECTED',
      entityType: 'SpecialistProfile',
      entityId: profileId,
      ipAddress: ip,
      success: true,
      metadata: { reason: dto.rejectionReason },
    });

    return { message: 'Solicitud rechazada' };
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
}
