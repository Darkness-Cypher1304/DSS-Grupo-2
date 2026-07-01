// ============================================================================
// ApplicationsModule — postulación de especialista (MedicalApplication)
// ============================================================================
// StorageService, AuditService, MailService y PrismaService son @Global, así que
// no hace falta importarlos aquí; basta declarar el controller y el service.
// ============================================================================

import { Module } from '@nestjs/common';

import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
