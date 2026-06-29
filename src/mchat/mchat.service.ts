// ============================================================================
// MchatService
// ============================================================================
// Maneja el cuestionario M-CHAT-R.
// CRÍTICO: el scoring se calcula SIEMPRE en el servidor (Zero Trust).
// El cliente envía solo las respuestas; el servidor calcula riesgo.
// ============================================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MchatRiskLevel, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MCHAT_QUESTIONS, calculateMchatResult } from './data/mchat-questions';
import { SubmitMchatDto } from './dto/mchat.dto';

@Injectable()
export class MchatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Devuelve las 20 preguntas (solo el texto, sin las respuestas esperadas
   * ni qué ítems son críticos — el cliente NO debe saber esto).
   */
  getQuestions() {
    return MCHAT_QUESTIONS.map((q) => ({
      number: q.number,
      id: q.id,
      text: q.text,
      category: q.category,
    }));
  }

  /**
   * Submit del cuestionario completo.
   * El padre envía las 20 respuestas; el servidor calcula riesgo.
   */
  async submit(parentId: string, parentRole: string, dto: SubmitMchatDto, ip: string) {
    // Validar que vienen las 20 respuestas
    const expectedIds = MCHAT_QUESTIONS.map((q) => q.id);
    const missing = expectedIds.filter((id) => !(id in dto.responses));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan respuestas para: ${missing.join(', ')}. Debes responder las 20 preguntas.`,
      );
    }

    // Calcular resultado oficial
    let result;
    try {
      result = calculateMchatResult(dto.responses);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    // Persistir con RLS activo (defensa: aunque haya bug, RLS bloquea)
    const screening = await this.prisma.runWithUserContext(parentId, parentRole, async (tx) => {
      return tx.mchatScreening.create({
        data: {
          parentId,
          childName: dto.childName,
          childAgeMonths: dto.childAgeMonths,
          childGender: dto.childGender,
          responses: dto.responses,
          totalScore: result.totalScore,
          riskLevel: result.riskLevel as MchatRiskLevel,
          recommendations: result.recommendations,
        },
      });
    });

    await this.audit.log({
      userId: parentId,
      action: 'MCHAT_COMPLETED',
      entityType: 'MchatScreening',
      entityId: screening.id,
      ipAddress: ip,
      success: true,
      metadata: {
        riskLevel: result.riskLevel,
        score: result.totalScore,
      },
    });

    return {
      id: screening.id,
      childAgeMonths: screening.childAgeMonths,
      totalScore: result.totalScore,
      criticalFailures: result.criticalFailures,
      riskLevel: result.riskLevel,
      failedQuestions: result.failedQuestions,
      recommendations: result.recommendations,
      createdAt: screening.createdAt,
    };
  }

  /**
   * Historial de evaluaciones del padre (RLS lo protege automáticamente).
   */
  async getMyHistory(parentId: string, parentRole: string) {
    return this.prisma.runWithUserContext(parentId, parentRole, async (tx) => {
      return tx.mchatScreening.findMany({
        where: { parentId }, // RLS además aplica
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          childName: true,
          childAgeMonths: true,
          totalScore: true,
          riskLevel: true,
          createdAt: true,
        },
      });
    });
  }

  async getOne(parentId: string, parentRole: string, screeningId: string) {
    const screening = await this.prisma.runWithUserContext(
      parentId,
      parentRole,
      async (tx) => tx.mchatScreening.findUnique({ where: { id: screeningId } }),
    );

    if (!screening) throw new NotFoundException('Evaluación no encontrada');

    // Control de acceso en capa de aplicación (defensa independiente del RLS):
    // solo el padre dueño o un admin pueden ver la evaluación. Cierra IDOR
    // (OWASP A01) aunque el RLS no esté activo en la conexión actual.
    // Devolvemos 404 (no 403) para no revelar que el recurso existe.
    if (screening.parentId !== parentId && parentRole !== UserRole.ADMIN) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    return screening;
  }
}
