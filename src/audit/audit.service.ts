// ============================================================================
// AuditService
// ============================================================================
// Registra acciones críticas en audit_logs (INSERT) y permite LEERLAS solo a
// los administradores. La tabla es INSERT-ONLY por política RLS — ni el
// desarrollador puede borrar su rastro, y solo ADMIN puede hacer SELECT.
// OWASP A09: Security Logging Failures.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

interface AuditLogInput {
  userId?: string | null;
  action: keyof typeof AuditAction;
  entityType?: string;
  entityId?: string;
  ipAddress: string;
  userAgent?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  action?: string;
  userId?: string;
  success?: boolean;
  page: number;
  perPage: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          action: input.action as AuditAction,
          entityType: input.entityType,
          entityId: input.entityId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          success: input.success ?? true,
          metadata: (input.metadata as object) || undefined,
        },
      });
    } catch (err) {
      // El audit log NUNCA debe romper el flujo principal.
      // Si falla, lo registramos en el log estructurado y seguimos.
      const error = err as Error;
      this.logger.error(`Falló registro de audit log: ${error.message}`, {
        attemptedAction: input.action,
        attemptedUserId: input.userId,
      });
    }
  }

  // ==========================================================================
  // LECTURA (solo ADMIN) — se ejecuta dentro del contexto RLS del admin para
  // que la política `audit_logs_admin_read_only` permita el SELECT.
  // ==========================================================================
  async findMany(adminId: string, q: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: q.action as AuditAction } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.success !== undefined ? { success: q.success } : {}),
    };

    return this.prisma.runWithUserContext(adminId, 'ADMIN', async (tx) => {
      const [items, total] = await Promise.all([
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (q.page - 1) * q.perPage,
          take: q.perPage,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            userId: true,
            ipAddress: true,
            success: true,
            metadata: true,
            createdAt: true,
            user: { select: { email: true, fullName: true, role: true } },
          },
        }),
        tx.auditLog.count({ where }),
      ]);

      return {
        items,
        total,
        page: q.page,
        perPage: q.perPage,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      };
    });
  }

  async stats(adminId: string) {
    return this.prisma.runWithUserContext(adminId, 'ADMIN', async (tx) => {
      const [total, failed, grouped] = await Promise.all([
        tx.auditLog.count(),
        tx.auditLog.count({ where: { success: false } }),
        tx.auditLog.groupBy({ by: ['action'], _count: { _all: true } }),
      ]);

      const byAction = grouped
        .map((g) => ({ action: g.action, count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      return { total, failed, successRate: total ? Math.round(((total - failed) / total) * 100) : 100, byAction };
    });
  }
}
