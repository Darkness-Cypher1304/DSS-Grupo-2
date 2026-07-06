// ============================================================================
// Unit · MchatService — scoring server-side, persistencia con RLS e IDOR
// ============================================================================

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { MchatService } from '../../../src/mchat/mchat.service';
import { AuditService } from '../../../src/audit/audit.service';
import type { SubmitMchatDto } from '../../../src/mchat/dto/mchat.dto';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { expectedAnswers } from '../../fixtures/mchat.fixture';
import { USER_IDS } from '../../fixtures/users.fixture';

function baseDto(): SubmitMchatDto {
  return {
    childName: 'Mateo',
    childAgeMonths: 24,
    childGender: 'M',
    responses: expectedAnswers(),
  };
}

describe('MchatService', () => {
  let prisma: PrismaMock;
  let audit: { log: jest.Mock };
  let service: MchatService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: jest.fn() };
    service = new MchatService(prisma, audit as unknown as AuditService);
  });

  describe('getQuestions', () => {
    it('devuelve 20 preguntas SIN filtrar la respuesta esperada ni si es crítica', () => {
      const questions = service.getQuestions();

      expect(questions).toHaveLength(20);
      questions.forEach((q) => {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('text');
        expect(q).not.toHaveProperty('expectedAnswer');
        expect(q).not.toHaveProperty('critical');
      });
    });
  });

  describe('submit', () => {
    it('persiste con RLS, audita y devuelve el resultado del scoring', async () => {
      prisma.mchatScreening.create.mockResolvedValue({
        id: 'screening-1',
        childAgeMonths: 24,
        createdAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await service.submit(USER_IDS.parent, UserRole.PARENT, baseDto(), '1.2.3.4');

      expect(prisma.runWithUserContext).toHaveBeenCalledWith(
        USER_IDS.parent,
        UserRole.PARENT,
        expect.any(Function),
      );
      expect(prisma.mchatScreening.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MCHAT_COMPLETED', success: true }),
      );
      expect(result).toMatchObject({ id: 'screening-1', totalScore: 0, riskLevel: 'LOW' });
    });

    it('lanza 400 si faltan respuestas', async () => {
      const dto = baseDto();
      delete dto.responses['q1'];

      await expect(
        service.submit(USER_IDS.parent, UserRole.PARENT, dto, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.mchatScreening.create).not.toHaveBeenCalled();
    });

    it('lanza 400 si una respuesta presente es inválida (scoring rechaza)', async () => {
      const dto = baseDto();
      (dto.responses as Record<string, string>)['q1'] = 'MAYBE';

      await expect(
        service.submit(USER_IDS.parent, UserRole.PARENT, dto, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOne (control de acceso / IDOR)', () => {
    it('lanza 404 si la evaluación no existe', async () => {
      prisma.mchatScreening.findUnique.mockResolvedValue(null);

      await expect(
        service.getOne(USER_IDS.parent, UserRole.PARENT, 'nope'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 (no 403) si el padre no es el dueño (cierra IDOR)', async () => {
      prisma.mchatScreening.findUnique.mockResolvedValue({
        id: 's1',
        parentId: 'otro-padre',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await expect(
        service.getOne(USER_IDS.parent, UserRole.PARENT, 's1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('permite al dueño ver su evaluación', async () => {
      const screening = { id: 's1', parentId: USER_IDS.parent };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.mchatScreening.findUnique.mockResolvedValue(screening as any);

      await expect(service.getOne(USER_IDS.parent, UserRole.PARENT, 's1')).resolves.toEqual(
        screening,
      );
    });

    it('permite a un ADMIN ver la evaluación de cualquier padre', async () => {
      const screening = { id: 's1', parentId: 'otro-padre' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.mchatScreening.findUnique.mockResolvedValue(screening as any);

      await expect(service.getOne(USER_IDS.admin, UserRole.ADMIN, 's1')).resolves.toEqual(
        screening,
      );
    });
  });

  describe('getMyHistory', () => {
    it('lista el historial del padre bajo contexto RLS', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.mchatScreening.findMany.mockResolvedValue([{ id: 's1' }] as any);

      const history = await service.getMyHistory(USER_IDS.parent, UserRole.PARENT);

      expect(prisma.runWithUserContext).toHaveBeenCalled();
      expect(history).toHaveLength(1);
    });
  });
});
