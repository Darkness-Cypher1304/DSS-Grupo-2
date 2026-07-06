// ============================================================================
// Unit · QuestionsService — consultas padre↔especialista (RLS, IDOR, anonimato)
// ============================================================================

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionStatus, UserRole } from '@prisma/client';

import { QuestionsService } from '../../../src/questions/questions.service';
import { AuditService } from '../../../src/audit/audit.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { createMailMock, MailMock } from '../../mocks/mail.mock';
import { USER_IDS } from '../../fixtures/users.fixture';

describe('QuestionsService', () => {
  let prisma: PrismaMock;
  let mail: MailMock;
  let audit: { log: jest.Mock };
  let notifications: { createForUser: jest.Mock };
  let service: QuestionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    mail = createMailMock();
    audit = { log: jest.fn() };
    notifications = { createForUser: jest.fn().mockResolvedValue(undefined) };
    service = new QuestionsService(
      prisma,
      audit as unknown as AuditService,
      mail,
      notifications as unknown as NotificationsService,
    );
  });

  describe('create', () => {
    it('crea la consulta bajo contexto RLS y audita', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.create.mockResolvedValue({ id: 'q1' } as any);

      const res = await service.create(
        USER_IDS.parent,
        UserRole.PARENT,
        { title: 't', body: 'b', childAgeMonths: 24 },
        '1.1.1.1',
      );

      expect(prisma.runWithUserContext).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'QUESTION_CREATED' }));
      expect(res).toMatchObject({ id: 'q1' });
    });
  });

  describe('list (visibilidad por rol)', () => {
    it('PARENT filtra por authorId', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      await service.list(USER_IDS.parent, UserRole.PARENT);
      expect(prisma.question.findMany.mock.calls[0][0]!.where).toEqual({ authorId: USER_IDS.parent });
    });

    it('SPECIALIST ve asignadas + OPEN sin asignar', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      await service.list(USER_IDS.specialist, UserRole.SPECIALIST);
      expect(prisma.question.findMany.mock.calls[0][0]!.where).toEqual({
        OR: [
          { assignedToId: USER_IDS.specialist },
          { assignedToId: null, status: QuestionStatus.OPEN },
        ],
      });
    });

    it('ADMIN ve todo (where vacío)', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      await service.list(USER_IDS.admin, UserRole.ADMIN);
      expect(prisma.question.findMany.mock.calls[0][0]!.where).toEqual({});
    });
  });

  describe('getOne (IDOR + anonimato)', () => {
    it('404 si no existe', async () => {
      prisma.question.findUnique.mockResolvedValue(null);
      await expect(service.getOne(USER_IDS.parent, UserRole.PARENT, 'q1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404 si un PARENT no es el autor (cierra IDOR)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.findUnique.mockResolvedValue({ id: 'q1', authorId: 'otro', status: QuestionStatus.OPEN } as any);
      await expect(service.getOne(USER_IDS.parent, UserRole.PARENT, 'q1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('oculta el autor a un especialista si la consulta es anónima', async () => {
      prisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: USER_IDS.parent,
        assignedToId: USER_IDS.specialist,
        status: QuestionStatus.ASSIGNED,
        isAnonymous: true,
        author: { id: USER_IDS.parent, fullName: 'Real' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const res = await service.getOne(USER_IDS.specialist, UserRole.SPECIALIST, 'q1');

      expect(res.author).toEqual({ id: 'anonymous', fullName: 'Padre (anónimo)' });
    });
  });

  describe('assignToMe', () => {
    it('403 si la consulta ya no está OPEN', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.findUnique.mockResolvedValueOnce({ id: 'q1', status: QuestionStatus.ASSIGNED } as any);
      await expect(
        service.assignToMe(USER_IDS.specialist, UserRole.SPECIALIST, 'q1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('asigna la consulta y notifica al padre (in-app + correo best-effort)', async () => {
      prisma.question.findUnique
        // 1ª: dentro del contexto (estado OPEN)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: 'q1', status: QuestionStatus.OPEN } as any)
        // 2ª: para notificar (autor)
        .mockResolvedValueOnce({
          title: 'Consulta',
          author: { id: USER_IDS.parent, email: 'p@test.pe', fullName: 'Padre' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.update.mockResolvedValue({ id: 'q1', status: QuestionStatus.ASSIGNED } as any);

      await service.assignToMe(USER_IDS.specialist, UserRole.SPECIALIST, 'q1');

      expect(prisma.question.update).toHaveBeenCalled();
      expect(notifications.createForUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ASSIGNED', userId: USER_IDS.parent }),
      );
      expect(mail.sendQuestionAssignedEmail).toHaveBeenCalled();
    });
  });

  describe('answer', () => {
    it('404 si la consulta no existe', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.answer(USER_IDS.specialist, UserRole.SPECIALIST, 'q1', { body: 'resp' }, '1.1.1.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('crea la respuesta, marca ANSWERED, audita y notifica', async () => {
      prisma.question.findUnique
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: 'q1', assignedToId: null } as any)
        .mockResolvedValueOnce({
          title: 'Consulta',
          author: { id: USER_IDS.parent, email: 'p@test.pe', fullName: 'Padre' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.answer.create.mockResolvedValue({ id: 'a1' } as any);

      const res = await service.answer(
        USER_IDS.specialist,
        UserRole.SPECIALIST,
        'q1',
        { body: 'resp' },
        '1.1.1.1',
      );

      expect(prisma.answer.create).toHaveBeenCalled();
      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: QuestionStatus.ANSWERED }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'QUESTION_ANSWERED' }));
      expect(mail.sendAnswerNotificationEmail).toHaveBeenCalled();
      expect(notifications.createForUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANSWER' }),
      );
      expect(res).toMatchObject({ id: 'a1' });
    });

    it('conserva el especialista ya asignado al responder', async () => {
      prisma.question.findUnique
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: 'q1', assignedToId: 'esp-previo' } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ title: 'C', author: { id: USER_IDS.parent, email: 'p@test.pe', fullName: 'P' } } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.answer.create.mockResolvedValue({ id: 'a2' } as any);

      await service.answer(USER_IDS.specialist, UserRole.SPECIALIST, 'q1', { body: 'x'.repeat(25) }, 'ip');

      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'esp-previo' }) }),
      );
    });
  });

  describe('close', () => {
    it('403 si no es el autor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.findUnique.mockResolvedValue({ id: 'q1', authorId: 'otro' } as any);
      await expect(service.close(USER_IDS.parent, UserRole.PARENT, 'q1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cierra la consulta del autor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.findUnique.mockResolvedValue({ id: 'q1', authorId: USER_IDS.parent } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.question.update.mockResolvedValue({ id: 'q1', status: QuestionStatus.CLOSED } as any);

      await service.close(USER_IDS.parent, UserRole.PARENT, 'q1');

      expect(prisma.question.update.mock.calls[0][0].data.status).toBe(QuestionStatus.CLOSED);
    });
  });

  describe('acceptAnswer', () => {
    it('403 si la consulta no es del padre', async () => {
      prisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        questionId: 'q1',
        question: { authorId: 'otro' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await expect(service.acceptAnswer(USER_IDS.parent, UserRole.PARENT, 'a1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('acepta una respuesta y desmarca las demás', async () => {
      prisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        questionId: 'q1',
        question: { authorId: USER_IDS.parent },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.answer.update.mockResolvedValue({ id: 'a1', isAccepted: true } as any);

      await service.acceptAnswer(USER_IDS.parent, UserRole.PARENT, 'a1');

      expect(prisma.answer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isAccepted: false } }),
      );
      expect(prisma.answer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isAccepted: true } }),
      );
    });
  });
});
