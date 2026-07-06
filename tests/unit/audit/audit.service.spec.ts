// ============================================================================
// Unit · AuditService — bitácora append-only (best-effort) y lectura admin (RLS)
// ============================================================================

import { AuditService } from '../../../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { USER_IDS } from '../../fixtures/users.fixture';

describe('AuditService', () => {
  let prisma: PrismaMock;
  let service: AuditService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuditService(prisma);
  });

  describe('log (best-effort)', () => {
    it('inserta la entrada de auditoría', async () => {
      await service.log({ action: 'USER_LOGIN_SUCCESS', ipAddress: '1.1.1.1' });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('NUNCA rompe el flujo si el insert falla', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.log({ action: 'USER_LOGIN_SUCCESS', ipAddress: '1.1.1.1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findMany (solo admin, bajo RLS)', () => {
    it('devuelve items y paginación', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }] as any);
      prisma.auditLog.count.mockResolvedValue(1);

      const res = await service.findMany(USER_IDS.admin, { page: 1, perPage: 20 });

      expect(prisma.runWithUserContext).toHaveBeenCalledWith(USER_IDS.admin, 'ADMIN', expect.any(Function));
      expect(res).toMatchObject({ total: 1, page: 1, perPage: 20, totalPages: 1 });
    });
  });

  describe('stats', () => {
    it('calcula total, fallidos, tasa de éxito y agrupado por acción', async () => {
      prisma.auditLog.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      // groupBy tiene un tipo sobrecargado complejo → casteo a jest.Mock
      (prisma.auditLog.groupBy as unknown as jest.Mock).mockResolvedValue([
        { action: 'USER_LOGIN_SUCCESS', _count: { _all: 7 } },
        { action: 'USER_LOGIN_FAILED', _count: { _all: 3 } },
      ]);

      const res = await service.stats(USER_IDS.admin);

      expect(res).toMatchObject({ total: 10, failed: 2, successRate: 80 });
      expect(res.byAction[0]).toMatchObject({ action: 'USER_LOGIN_SUCCESS', count: 7 });
    });
  });
});
