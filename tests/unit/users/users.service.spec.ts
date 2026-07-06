// ============================================================================
// Unit · UsersService — perfil, gestión admin y ciclo de vida de cuentas
// ============================================================================

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeaveRequestStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../../../src/users/users.service';
import { AuditService } from '../../../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { dbUser } from '../../fixtures/db-user.fixture';
import { USER_IDS } from '../../fixtures/users.fixture';

const configMock = {
  get: (key: string, def?: unknown) => process.env[key] ?? def,
} as unknown as ConfigService;

describe('UsersService', () => {
  let prisma: PrismaMock;
  let audit: { log: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: jest.fn() };
    service = new UsersService(prisma, audit as unknown as AuditService, configMock);
  });

  describe('getMyProfile', () => {
    it('404 si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMyProfile('u1')).rejects.toThrow(NotFoundException);
    });

    it('excluye campos sensibles', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', passwordHash: 'secreto', emailVerificationToken: 'tok' }),
      );
      const res = await service.getMyProfile('u1');
      expect(res).not.toHaveProperty('passwordHash');
      expect(res).not.toHaveProperty('emailVerificationToken');
    });
  });

  describe('updateMyProfile', () => {
    it('actualiza, audita y devuelve el perfil saneado', async () => {
      prisma.user.update.mockResolvedValue(dbUser({ id: 'u1', fullName: 'Nuevo' }));
      const res = await service.updateMyProfile('u1', { fullName: 'Nuevo' }, 'ip');
      expect(res).not.toHaveProperty('passwordHash');
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('requestSpecialistUpgrade', () => {
    it('404 si no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.requestSpecialistUpgrade('u1', { licenseNumber: 'X', specialty: 'S', institution: 'I', yearsOfExperience: 1, bio: 'b' }, 'ip'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si ya es especialista verificado', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...dbUser({ role: UserRole.SPECIALIST }),
        specialistProfile: { verificationStatus: 'APPROVED' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await expect(
        service.requestSpecialistUpgrade('u1', { licenseNumber: 'X', specialty: 'S', institution: 'I', yearsOfExperience: 1, bio: 'b' }, 'ip'),
      ).rejects.toThrow(/Ya eres especialista/i);
    });

    it('crea/actualiza el perfil en PENDING y audita', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ ...dbUser(), specialistProfile: null } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.specialistProfile.upsert.mockResolvedValue({ id: 'p1' } as any);
      const res = await service.requestSpecialistUpgrade('u1', { licenseNumber: 'X', specialty: 'S', institution: 'I', yearsOfExperience: 1, bio: 'b' }, 'ip');
      expect(prisma.specialistProfile.upsert).toHaveBeenCalled();
      expect(res.message).toMatch(/Solicitud enviada/i);
    });
  });

  describe('verifySpecialist', () => {
    it('404 si el perfil no existe', async () => {
      prisma.specialistProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.verifySpecialist('p1', USER_IDS.admin, { decision: 'APPROVED' }, 'ip'),
      ).rejects.toThrow(NotFoundException);
    });

    it('APPROVED: transacción (perfil + rol) y audita', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.specialistProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' } as any);
      const res = await service.verifySpecialist('p1', USER_IDS.admin, { decision: 'APPROVED' }, 'ip');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SPECIALIST_VERIFIED' }));
      expect(res.message).toMatch(/aprobado/i);
    });

    it('REJECTED: actualiza con motivo y audita', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.specialistProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' } as any);
      const res = await service.verifySpecialist('p1', USER_IDS.admin, { decision: 'REJECTED', rejectionReason: 'faltan docs' }, 'ip');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SPECIALIST_REJECTED' }));
      expect(res.message).toMatch(/rechazada/i);
    });
  });

  describe('verifyUserEmail / updateUserStatus / listUsers', () => {
    it('verifyUserEmail 404 si no existe, si existe activa', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.verifyUserEmail('u1', USER_IDS.admin, 'ip')).rejects.toThrow(NotFoundException);

      prisma.user.findUnique.mockResolvedValueOnce(dbUser({ id: 'u1' }));
      const res = await service.verifyUserEmail('u1', USER_IDS.admin, 'ip');
      expect(res.message).toMatch(/verificado/i);
    });

    it('updateUserStatus actualiza y audita', async () => {
      const res = await service.updateUserStatus('u1', { status: UserStatus.SUSPENDED }, USER_IDS.admin, 'ip');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_STATUS_CHANGED' }));
      expect(res.message).toMatch(/actualizado/i);
    });

    it('listUsers pagina', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      const res = await service.listUsers(1, 20);
      expect(res.pagination).toMatchObject({ page: 1, perPage: 20, total: 0 });
    });
  });

  describe('requestAccountDeletion (PARENT)', () => {
    const pwd = 'Zx9!vQ2#mLw7';

    it('rechaza si el rol no es PARENT', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.SPECIALIST }));
      await expect(
        service.requestAccountDeletion('u1', { password: pwd }, 'ip'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la contraseña es incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ role: UserRole.PARENT, passwordHash: await bcrypt.hash(pwd, 4) }),
      );
      await expect(
        service.requestAccountDeletion('u1', { password: 'incorrecta' }, 'ip'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('programa la eliminación, revoca sesiones y audita', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({ id: 'u1', role: UserRole.PARENT, status: UserStatus.ACTIVE, passwordHash: await bcrypt.hash(pwd, 4) }),
      );
      const res = await service.requestAccountDeletion('u1', { password: pwd, reason: 'ya no lo uso' }, 'ip');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: UserStatus.PENDING_DELETION }) }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(res.scheduledFor).toBeInstanceOf(Date);
    });

    it('si ya está PENDING_DELETION devuelve la fecha programada sin re-actualizar', async () => {
      prisma.user.findUnique.mockResolvedValue(
        dbUser({
          role: UserRole.PARENT,
          status: UserStatus.PENDING_DELETION,
          deletionRequestedAt: new Date(),
          passwordHash: await bcrypt.hash(pwd, 4),
        }),
      );
      const res = await service.requestAccountDeletion('u1', { password: pwd }, 'ip');
      expect(res.message).toMatch(/ya está programada/i);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelAccountDeletion', () => {
    it('rechaza si la cuenta no está en eliminación', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ status: UserStatus.ACTIVE }));
      await expect(service.cancelAccountDeletion('u1', 'ip')).rejects.toThrow(BadRequestException);
    });

    it('reactiva la cuenta', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: 'u1', status: UserStatus.PENDING_DELETION }));
      const res = await service.cancelAccountDeletion('u1', 'ip');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: UserStatus.ACTIVE }) }),
      );
      expect(res.message).toMatch(/activa/i);
    });
  });

  describe('requestSpecialistLeave', () => {
    it('rechaza si no es especialista', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ ...dbUser({ role: UserRole.PARENT }), leaveRequest: null } as any);
      await expect(
        service.requestSpecialistLeave('u1', { reason: 'x' }, 'ip'),
      ).rejects.toThrow(/especialista/i);
    });

    it('rechaza si ya hay una baja pendiente', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...dbUser({ role: UserRole.SPECIALIST }),
        leaveRequest: { status: LeaveRequestStatus.PENDING },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await expect(
        service.requestSpecialistLeave('u1', { reason: 'x' }, 'ip'),
      ).rejects.toThrow(/pendiente/i);
    });

    it('crea la solicitud de baja', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ ...dbUser({ role: UserRole.SPECIALIST }), leaveRequest: null } as any);
      const res = await service.requestSpecialistLeave('u1', { reason: 'mudanza' }, 'ip');
      expect(prisma.specialistLeaveRequest.upsert).toHaveBeenCalled();
      expect(res.message).toMatch(/baja enviada/i);
    });
  });

  describe('approve/rejectLeaveRequest', () => {
    it('approve 404 si no existe', async () => {
      prisma.specialistLeaveRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.approveLeaveRequest('l1', USER_IDS.admin, {}, 'ip'),
      ).rejects.toThrow(NotFoundException);
    });

    it('approve pone la cuenta INACTIVE y revoca sesiones', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.specialistLeaveRequest.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', status: LeaveRequestStatus.PENDING } as any);
      const res = await service.approveLeaveRequest('l1', USER_IDS.admin, { note: 'ok' }, 'ip');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.message).toMatch(/inactiva/i);
    });

    it('reject 400 si ya fue procesada', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.specialistLeaveRequest.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', status: LeaveRequestStatus.APPROVED } as any);
      await expect(
        service.rejectLeaveRequest('l1', USER_IDS.admin, {}, 'ip'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processExpiredDeletions (sistema)', () => {
    it('anonimiza las cuentas vencidas y retorna el conteo', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }] as any);

      const res = await service.processExpiredDeletions();

      expect(res.processed).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledTimes(2);
    });

    it('no hace nada si no hay cuentas vencidas', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const res = await service.processExpiredDeletions();
      expect(res.processed).toBe(0);
    });
  });
});
