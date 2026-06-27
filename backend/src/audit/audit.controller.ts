// ============================================================================
// AuditController — Visor de auditoría (solo ADMIN)
// ============================================================================
// Expone el rastro de auditoría a los administradores. La tabla audit_logs es
// INSERT-ONLY por RLS y solo ADMIN puede leerla (defensa en profundidad: la BD
// vuelve a verificar el rol vía `audit_logs_admin_read_only`).
// ============================================================================

import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AuditService } from './audit.service';
import { CurrentUser, AuthUser, Roles } from '../common/decorators';

@ApiTags('Auditoría')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // --------------------------------------------------------------------------
  // GET /audit/stats — resumen (total, fallidos, % éxito, conteo por acción)
  // --------------------------------------------------------------------------
  @Roles(UserRole.ADMIN)
  @Get('stats')
  @ApiOperation({ summary: 'Resumen del rastro de auditoría (solo admin)' })
  stats(@CurrentUser() admin: AuthUser) {
    return this.audit.stats(admin.sub);
  }

  // --------------------------------------------------------------------------
  // GET /audit — listado paginado con filtros (action, userId, success)
  // --------------------------------------------------------------------------
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Listar registros de auditoría (solo admin)' })
  list(
    @CurrentUser() admin: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
  ) {
    return this.audit.findMany(admin.sub, {
      page: Math.max(1, page),
      perPage: Math.min(Math.max(perPage, 1), 100),
      action: action || undefined,
      userId: userId || undefined,
      success: success === undefined ? undefined : success === 'true',
    });
  }
}
