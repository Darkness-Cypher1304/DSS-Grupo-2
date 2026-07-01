// ============================================================================
// ApplicationsService — postulación de especialista (SIN cuenta hasta aprobar)
// ============================================================================
// Implementa el flujo del prompt (pantallas 9→14):
//   submit()   → crea una MedicalApplication (NO un User) + guarda documentos
//   listForAdmin()/getOneForAdmin() → cola de revisión del admin (pantalla 12)
//   approve()  → transacción ATÓMICA: crea User(SPECIALIST)+SpecialistProfile+
//                token de activación; si algo falla, rollback total (pantalla 13)
//   reject()   → rechazo con motivo
// La activación de la cuenta (crear contraseña) vive en AuthService.
// ============================================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApplicationStatus, SpecialistVerificationStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import {
  SubmitApplicationDto,
  ApproveApplicationDto,
  RejectApplicationDto,
} from './dto/applications.dto';

// Tipado mínimo del archivo que inyecta multer (sin depender de @types/multer).
export interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h (§9: token de vida corta)

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  // --------------------------------------------------------------------------
  // ENVIAR POSTULACIÓN (público, pantalla 9.5) — NO crea User
  // --------------------------------------------------------------------------
  async submit(
    dto: SubmitApplicationDto,
    cvFile: UploadedMulterFile | undefined,
    dniFile: UploadedMulterFile | undefined,
    ip: string,
    userAgent: string,
  ): Promise<{ message: string; applicationId: string }> {
    if (dto.consentAccepted !== 'true') {
      throw new BadRequestException(
        'Debes aceptar que NeuroAlert verifique tus credenciales para postular.',
      );
    }
    if (!cvFile) throw new BadRequestException('Adjunta tu currículum (PDF).');
    if (!dniFile) throw new BadRequestException('Adjunta tu documento de identidad (DNI).');
    // El CV debe ser un PDF (el DNI puede ser PDF o imagen). storeFile valida
    // además los MAGIC BYTES: el contenido real debe coincidir con el tipo.
    if (cvFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('El currículum debe ser un archivo PDF.');
    }

    // Prevenir postulaciones duplicadas ANTES de guardar archivos (evita huérfanos).
    const dup = await this.prisma.medicalApplication.findFirst({
      where: {
        status: ApplicationStatus.PENDING,
        OR: [{ email: dto.email }, { licenseNumber: dto.licenseNumber }],
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'Ya existe una postulación en revisión con ese correo o número de colegiatura.',
      );
    }

    // Guardar documentos (valida whitelist + magic-bytes + tamaño, hashea SHA-256).
    // ownerId = null: aún no hay cuenta. Carpeta 'specialist-docs'.
    const cv = await this.storage.storeFile(
      cvFile.buffer,
      cvFile.originalname,
      cvFile.mimetype,
      'specialist-docs',
      undefined, // ownerId: aún no hay cuenta
    );
    const dni = await this.storage.storeFile(
      dniFile.buffer,
      dniFile.originalname,
      dniFile.mimetype,
      'specialist-docs',
      undefined,
    );

    const app = await this.prisma.medicalApplication.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        licenseNumber: dto.licenseNumber,
        specialty: dto.specialty,
        university: dto.university,
        country: dto.country,
        cvFileId: cv.id,
        cvSha256: cv.sha256,
        dniFileId: dni.id,
        dniSha256: dni.sha256,
        linkedinUrl: dto.linkedinUrl,
        yearsOfExperience: dto.yearsOfExperience,
        availability: dto.availability,
        motivationLetter: dto.motivationLetter,
        consentAccepted: dto.consentAccepted === 'true',
        submittedIp: ip,
        submittedUserAgent: userAgent,
        status: ApplicationStatus.PENDING,
      },
    });

    // Auditoría (§9: fecha + IP + hash de documentos ya persistidos en la fila).
    await this.audit.log({
      userId: null,
      action: 'USER_REGISTERED',
      entityType: 'MedicalApplication',
      entityId: app.id,
      ipAddress: ip,
      userAgent,
      success: true,
      metadata: {
        event: 'SPECIALIST_APPLICATION_SUBMITTED',
        email: dto.email,
        licenseNumber: dto.licenseNumber,
        cvSha256: cv.sha256,
        dniSha256: dni.sha256,
      },
    });

    // Correo de confirmación (pantalla 11): resumen COMPLETO de lo enviado.
    this.dispatchMail(
      this.mail.sendApplicationReceivedEmail(dto.email, `${dto.firstName} ${dto.lastName}`, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        licenseNumber: dto.licenseNumber,
        specialty: dto.specialty,
        university: dto.university,
        country: dto.country,
        linkedinUrl: dto.linkedinUrl,
        yearsOfExperience: dto.yearsOfExperience,
        availability: dto.availability,
        motivationLetter: dto.motivationLetter,
        cvFileName: cvFile.originalname,
        dniFileName: dniFile.originalname,
      }),
      'application-received',
    );

    return {
      message: 'Postulación recibida. Revisa tu correo para ver los detalles de tu solicitud.',
      applicationId: app.id,
    };
  }

  // --------------------------------------------------------------------------
  // ADMIN: listar postulaciones (pantalla 12), filtrable por estado
  // --------------------------------------------------------------------------
  async listForAdmin(status?: ApplicationStatus) {
    return this.prisma.medicalApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      // Nunca exponer el activationToken.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        licenseNumber: true,
        specialty: true,
        university: true,
        country: true,
        yearsOfExperience: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewedById: true,
        rejectionReason: true,
      },
    });
  }

  // --------------------------------------------------------------------------
  // ADMIN: detalle de una postulación + tokens de descarga de documentos
  // --------------------------------------------------------------------------
  async getOneForAdmin(id: string) {
    const app = await this.prisma.medicalApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Postulación no encontrada');

    // Tokens efímeros (HMAC, 15 min) para previsualizar CV/DNI sin exponer ids.
    const { activationToken, activationExpiresAt, ...safe } = app;
    void activationToken;
    void activationExpiresAt;
    return {
      ...safe,
      cvDownloadToken: this.storage.createDownloadToken(app.cvFileId),
      dniDownloadToken: this.storage.createDownloadToken(app.dniFileId),
    };
  }

  // --------------------------------------------------------------------------
  // ADMIN: APROBAR (pantalla 12→13) — transacción atómica + activación
  // --------------------------------------------------------------------------
  async approve(id: string, adminId: string, dto: ApproveApplicationDto, ip: string) {
    const app = await this.prisma.medicalApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Postulación no encontrada');
    if (app.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Esta postulación ya fue procesada.');
    }

    // El checklist (6 ítems) DEBE estar completo para habilitar la aprobación.
    const c = dto.checklist;
    const allChecked =
      c.dniValidated &&
      c.cmpVerified &&
      c.cvReviewed &&
      c.interviewDone &&
      c.documentsComplete &&
      c.noInconsistencies;
    if (!allChecked) {
      throw new BadRequestException(
        'Debes completar todos los ítems del checklist antes de aprobar.',
      );
    }

    const activationToken = randomBytes(32).toString('hex');
    const activationExpiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
    // Contraseña placeholder inutilizable: el especialista define la suya real al
    // activar (nunca se envía contraseña por correo). La cuenta queda
    // PENDING_VERIFICATION (login bloqueado) hasta la activación.
    const placeholderHash = await bcrypt.hash(randomBytes(48).toString('hex'), 12);

    let createdUserId: string;
    try {
      createdUserId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: app.email,
            passwordHash: placeholderHash,
            fullName: `${app.firstName} ${app.lastName}`.trim(),
            phoneNumber: app.phoneNumber,
            role: UserRole.SPECIALIST,
            status: UserStatus.PENDING_VERIFICATION,
            emailVerified: false,
          },
        });

        await tx.specialistProfile.create({
          data: {
            userId: user.id,
            licenseNumber: app.licenseNumber,
            specialty: app.specialty,
            institution: app.university,
            yearsOfExperience: app.yearsOfExperience,
            bio: app.motivationLetter,
            verificationStatus: SpecialistVerificationStatus.APPROVED,
            verifiedAt: new Date(),
            verifiedById: adminId,
            cvDocumentKey: app.cvFileId,
            licenseDocumentKey: app.dniFileId,
          },
        });

        await tx.medicalApplication.update({
          where: { id: app.id },
          data: {
            status: ApplicationStatus.APPROVED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            createdUserId: user.id,
            activationToken,
            activationExpiresAt,
            checklist: { ...c },
          },
        });

        return user.id;
      });
    } catch (err) {
      // P2002 = email o colegiatura ya pertenecen a una cuenta existente.
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'El correo o la colegiatura ya pertenecen a una cuenta existente. Revisa antes de aprobar.',
        );
      }
      throw err;
    }

    await this.audit.log({
      userId: adminId,
      action: 'SPECIALIST_VERIFIED',
      entityType: 'MedicalApplication',
      entityId: app.id,
      ipAddress: ip,
      success: true,
      metadata: { checklist: { ...c }, createdUserId },
    });

    // Correo de aprobación (pantalla 13): SIN contraseña, con enlace de activación.
    this.dispatchMail(
      this.mail.sendApplicationApprovedEmail(
        app.email,
        `${app.firstName} ${app.lastName}`.trim(),
        activationToken,
      ),
      'application-approved',
    );

    return { message: 'Especialista aprobado. Se envió el enlace de activación a su correo.' };
  }

  // --------------------------------------------------------------------------
  // ADMIN: RECHAZAR (con motivo)
  // --------------------------------------------------------------------------
  async reject(id: string, adminId: string, dto: RejectApplicationDto, ip: string) {
    const app = await this.prisma.medicalApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Postulación no encontrada');
    if (app.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Esta postulación ya fue procesada.');
    }

    await this.prisma.medicalApplication.update({
      where: { id: app.id },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'SPECIALIST_REJECTED',
      entityType: 'MedicalApplication',
      entityId: app.id,
      ipAddress: ip,
      success: true,
      metadata: { reason: dto.rejectionReason },
    });

    this.dispatchMail(
      this.mail.sendApplicationRejectedEmail(
        app.email,
        `${app.firstName} ${app.lastName}`.trim(),
        dto.rejectionReason,
      ),
      'application-rejected',
    );

    return { message: 'Postulación rechazada. Se notificó al postulante.' };
  }

  // --------------------------------------------------------------------------
  // Enviar correo sin bloquear (fire-and-forget); los errores se registran.
  // --------------------------------------------------------------------------
  private dispatchMail(promise: Promise<void>, context: string): void {
    void promise.catch((err) =>
      this.logger.error(`Fallo al enviar correo (${context}): ${(err as Error).message}`),
    );
  }
}
