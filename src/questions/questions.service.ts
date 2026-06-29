// ============================================================================
// QuestionsService
// ============================================================================
// Las consultas padre→especialista usan RLS:
//   - El padre solo ve sus preguntas.
//   - El especialista ve las OPEN sin asignar y las que tiene asignadas.
//   - El admin ve todo.
// ============================================================================

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QuestionStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAnswerDto, CreateQuestionDto } from './dto/questions.dto';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------------------------
  // PARENT: crear pregunta
  // --------------------------------------------------------------------------
  async create(parentId: string, parentRole: string, dto: CreateQuestionDto, ip: string) {
    const question = await this.prisma.runWithUserContext(parentId, parentRole, async (tx) => {
      return tx.question.create({
        data: {
          authorId: parentId,
          title: dto.title,
          body: dto.body,
          childAgeMonths: dto.childAgeMonths,
          isUrgent: dto.isUrgent ?? false,
          isAnonymous: dto.isAnonymous ?? true,
          status: QuestionStatus.OPEN,
        },
      });
    });

    await this.audit.log({
      userId: parentId,
      action: 'QUESTION_CREATED',
      entityType: 'Question',
      entityId: question.id,
      ipAddress: ip,
      success: true,
    });

    return question;
  }

  // --------------------------------------------------------------------------
  // Listar consultas (RLS filtra automáticamente según rol)
  // --------------------------------------------------------------------------
  async list(userId: string, role: string) {
    return this.prisma.runWithUserContext(userId, role, async (tx) => {
      return tx.question.findMany({
        orderBy: [{ isUrgent: 'desc' }, { createdAt: 'desc' }],
        include: {
          author: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
          answers: { select: { id: true } },
        },
      });
    });
  }

  async getOne(userId: string, role: string, questionId: string) {
    const result = await this.prisma.runWithUserContext(userId, role, async (tx) => {
      return tx.question.findUnique({
        where: { id: questionId },
        include: {
          author: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
          answers: {
            include: {
              specialist: {
                select: {
                  id: true,
                  fullName: true,
                  specialistProfile: { select: { specialty: true, institution: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    if (!result) throw new NotFoundException('Consulta no encontrada');

    // Control de acceso en capa de aplicación (defensa independiente del RLS):
    // replica la política RLS questions_visibility. Cierra IDOR (OWASP A01)
    // aunque el RLS no esté activo en la conexión actual.
    // Devolvemos 404 (no 403) para no revelar que el recurso existe.
    const canView =
      role === UserRole.ADMIN ||
      (role === UserRole.PARENT && result.authorId === userId) ||
      (role === UserRole.SPECIALIST &&
        (result.assignedToId === userId ||
          (result.assignedToId === null && result.status === QuestionStatus.OPEN)));

    if (!canView) throw new NotFoundException('Consulta no encontrada');

    // Si es anónima, ocultar autor a especialistas (no admin)
    if (result.isAnonymous && role === UserRole.SPECIALIST) {
      result.author = { id: 'anonymous', fullName: 'Padre (anónimo)' };
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // SPECIALIST: tomar/asignarse una consulta
  // --------------------------------------------------------------------------
  async assignToMe(specialistId: string, role: string, questionId: string) {
    const question = await this.prisma.runWithUserContext(specialistId, role, async (tx) => {
      const q = await tx.question.findUnique({ where: { id: questionId } });
      if (!q) throw new NotFoundException('Consulta no encontrada');
      if (q.status !== QuestionStatus.OPEN) {
        throw new ForbiddenException('Esta consulta ya fue tomada');
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          assignedToId: specialistId,
          status: QuestionStatus.ASSIGNED,
        },
      });
    });

    return question;
  }

  // --------------------------------------------------------------------------
  // SPECIALIST: responder consulta
  // --------------------------------------------------------------------------
  async answer(
    specialistId: string,
    role: string,
    questionId: string,
    dto: CreateAnswerDto,
    ip: string,
  ) {
    const result = await this.prisma.runWithUserContext(specialistId, role, async (tx) => {
      const q = await tx.question.findUnique({ where: { id: questionId } });
      if (!q) throw new NotFoundException('Consulta no encontrada');

      // Crear respuesta
      const answer = await tx.answer.create({
        data: {
          questionId,
          specialistId,
          body: dto.body,
        },
      });

      // Marcar pregunta como ANSWERED + asignar al especialista si no estaba asignado
      await tx.question.update({
        where: { id: questionId },
        data: {
          status: QuestionStatus.ANSWERED,
          assignedToId: q.assignedToId || specialistId,
        },
      });

      return answer;
    });

    await this.audit.log({
      userId: specialistId,
      action: 'QUESTION_ANSWERED',
      entityType: 'Answer',
      entityId: result.id,
      ipAddress: ip,
      success: true,
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // PARENT: cerrar su propia consulta
  // --------------------------------------------------------------------------
  async close(parentId: string, role: string, questionId: string) {
    return this.prisma.runWithUserContext(parentId, role, async (tx) => {
      const q = await tx.question.findUnique({ where: { id: questionId } });
      if (!q) throw new NotFoundException('Consulta no encontrada');
      if (q.authorId !== parentId) throw new ForbiddenException('No autorizado');

      return tx.question.update({
        where: { id: questionId },
        data: { status: QuestionStatus.CLOSED, closedAt: new Date() },
      });
    });
  }

  // --------------------------------------------------------------------------
  // PARENT: marcar respuesta como aceptada
  // --------------------------------------------------------------------------
  async acceptAnswer(parentId: string, role: string, answerId: string) {
    return this.prisma.runWithUserContext(parentId, role, async (tx) => {
      const answer = await tx.answer.findUnique({
        where: { id: answerId },
        include: { question: true },
      });
      if (!answer) throw new NotFoundException('Respuesta no encontrada');
      if (answer.question.authorId !== parentId) {
        throw new ForbiddenException('No autorizado');
      }

      // Solo una respuesta puede ser aceptada por pregunta
      await tx.answer.updateMany({
        where: { questionId: answer.questionId },
        data: { isAccepted: false },
      });

      return tx.answer.update({
        where: { id: answerId },
        data: { isAccepted: true },
      });
    });
  }
}
