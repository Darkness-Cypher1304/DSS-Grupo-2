// ============================================================================
// AuditModule
// ============================================================================
// @Global: AuditService está disponible en toda la app sin reimportar el módulo.
// Expone además el AuditController (visor de auditoría solo-admin).
// ============================================================================

import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
