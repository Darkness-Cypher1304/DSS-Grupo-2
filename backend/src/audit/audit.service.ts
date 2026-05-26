// ============================================================================
// AuditService
// ============================================================================
// Registra acciones críticas en audit_logs.
// La tabla es INSERT-ONLY por política RLS — ni el desarrollador puede borrar
// su rastro. OWASP A09: Security Logging Failures.
// ============================================================================

import { Global, Module, Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

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
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
