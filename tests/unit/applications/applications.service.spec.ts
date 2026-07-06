// ============================================================================
// Unit · ApplicationsService — postulación de especialista (sin cuenta) y alta
// atómica al aprobar (User + SpecialistProfile + token de activación).
// ============================================================================

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

import { ApplicationsService, UploadedMulterFile } from '../../../src/applications/applications.service';
import { StorageService } from '../../../src/storage/storage.service';
import { AuditService } from '../../../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { createMailMock, MailMock } from '../../mocks/mail.mock';
import { USER_IDS } from '../../fixtures/users.fixture';

function file(mimetype = 'application/pdf'): UploadedMulterFile {
  return { buffer: Buffer.from('%PDF-1.4 data'), originalname: 'doc.pdf', mimetype, size: 12 };
}

const validDto = {
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'ana@med.pe',
  phoneNumber: '999888777',
  licenseNumber: 'CMP12345',
  specialty: 'Pediatría',
  university: 'UNMSM',
  country: 'PE',
  yearsOfExperience: 8,
  availability: 'Tardes',
  motivationLetter: 'Quiero ayudar',
  consentAccepted: 'true',
};

const fullChecklist = {
  dniValidated: true,
  cmpVerified: true,
  cvReviewed: true,
  interviewDone: true,
  documentsComplete: true,
  noInconsistencies: true,
};

describe('ApplicationsService', () => {
  let prisma: PrismaMock;
  let storage: ReturnType<typeof mockDeep<StorageService>>;
  let mail: MailMock;
  let audit: { log: jest.Mock };
  let service: ApplicationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    storage = mockDeep<StorageService>();
    mail = createMailMock();
    audit = { log: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage.storeFile.mockResolvedValue({ id: 'file', sha256: 'hash', fileName: 'f', mimeType: 'application/pdf', sizeBytes: 1 } as any);
    storage.createDownloadToken.mockReturnValue('dl-token');
    service = new ApplicationsService(prisma, storage, audit as unknown as AuditService, mail);
  });

  describe('submit', () => {
    it('rechaza si no se acepta el consentimiento', async () => {
      await expect(
        service.submit({ ...validDto, consentAccepted: 'false' }, file(), file(), 'ip', 'ua'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falta el CV o el DNI', async () => {
      await expect(service.submit(validDto, undefined, file(), 'ip', 'ua')).rejects.toThrow(/currículum/i);
      await expect(service.submit(validDto, file(), undefined, 'ip', 'ua')).rejects.toThrow(/identidad/i);
    });

    it('rechaza si el CV no es PDF', async () => {
      await expect(
        service.submit(validDto, file('image/png'), file(), 'ip', 'ua'),
      ).rejects.toThrow(/PDF/i);
    });

    it('rechaza (409) si el correo ya tiene cuenta', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
      await expect(service.submit(validDto, file(), file(), 'ip', 'ua')).rejects.toThrow(
        ConflictException,
      );
    });

    it('rechaza (409) si ya hay una postulación PENDING con ese correo/colegiatura', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.medicalApplication.findFirst.mockResolvedValue({ id: 'dup' } as any);
      await expect(service.submit(validDto, file(), file(), 'ip', 'ua')).rejects.toThrow(
        ConflictException,
      );
    });

    it('crea la postulación, guarda documentos, audita y responde applicationId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.medicalApplication.findFirst.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.medicalApplication.create.mockResolvedValue({ id: 'app1' } as any);

      const res = await service.submit(validDto, file(), file(), 'ip', 'ua');

      expect(storage.storeFile).toHaveBeenCalledTimes(2);
      expect(prisma.medicalApplication.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
      expect(mail.sendApplicationReceivedEmail).toHaveBeenCalled();
      expect(res.applicationId).toBe('app1');
    });
  });

  describe('getOneForAdmin', () => {
    it('404 si no existe', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue(null);
      await expect(service.getOneForAdmin('x')).rejects.toThrow(NotFoundException);
    });

    it('devuelve tokens de descarga y NUNCA el activationToken', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue({
        id: 'app1',
        cvFileId: 'cv',
        dniFileId: 'dni',
        activationToken: 'SECRETO',
        activationExpiresAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const res = await service.getOneForAdmin('app1');

      expect(res).not.toHaveProperty('activationToken');
      expect(res.cvDownloadToken).toBe('dl-token');
      expect(res.dniDownloadToken).toBe('dl-token');
    });
  });

  describe('approve', () => {
    it('404 si no existe / 400 si ya fue procesada', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.approve('x', USER_IDS.admin, { checklist: fullChecklist }, 'ip'),
      ).rejects.toThrow(NotFoundException);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.medicalApplication.findUnique.mockResolvedValueOnce({ id: 'app1', status: ApplicationStatus.APPROVED } as any);
      await expect(
        service.approve('app1', USER_IDS.admin, { checklist: fullChecklist }, 'ip'),
      ).rejects.toThrow(/ya fue procesada/i);
    });

    it('400 si el checklist está incompleto', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.medicalApplication.findUnique.mockResolvedValue({ id: 'app1', status: ApplicationStatus.PENDING } as any);
      await expect(
        service.approve('app1', USER_IDS.admin, { checklist: { ...fullChecklist, cvReviewed: false } }, 'ip'),
      ).rejects.toThrow(/checklist/i);
    });

    it('crea la cuenta de especialista en una transacción y audita', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue({
        id: 'app1',
        status: ApplicationStatus.PENDING,
        email: 'ana@med.pe',
        firstName: 'Ana',
        lastName: 'Ruiz',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.create.mockResolvedValue({ id: 'u-new' } as any);

      const res = await service.approve('app1', USER_IDS.admin, { checklist: fullChecklist }, 'ip');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.specialistProfile.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SPECIALIST_VERIFIED' }));
      expect(mail.sendApplicationApprovedEmail).toHaveBeenCalled();
      expect(res.message).toMatch(/aprobado/i);
    });

    it('mapea P2002 a Conflict (correo/colegiatura ya existen)', async () => {
      prisma.medicalApplication.findUnique.mockResolvedValue({
        id: 'app1',
        status: ApplicationStatus.PENDING,
        email: 'ana@med.pe',
        firstName: 'Ana',
        lastName: 'Ruiz',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.approve('app1', USER_IDS.admin, { checklist: fullChecklist }, 'ip'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reject', () => {
    it('rechaza la postulación con motivo y notifica', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.medicalApplication.findUnique.mockResolvedValue({ id: 'app1', status: ApplicationStatus.PENDING, email: 'ana@med.pe', firstName: 'Ana', lastName: 'Ruiz' } as any);

      const res = await service.reject('app1', USER_IDS.admin, { rejectionReason: 'Documentos ilegibles' }, 'ip');

      expect(prisma.medicalApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ApplicationStatus.REJECTED }) }),
      );
      expect(mail.sendApplicationRejectedEmail).toHaveBeenCalled();
      expect(res.message).toMatch(/rechazada/i);
    });
  });
});
