// ============================================================================
// StorageModule — almacenamiento de archivos en PostgreSQL (reemplaza MinIO)
// ============================================================================
// Global para que StorageService pueda inyectarse donde haga falta (p.ej. users
// para los documentos del especialista). Expone el StorageController.
// ============================================================================

import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

export { StorageService } from './storage.service';
