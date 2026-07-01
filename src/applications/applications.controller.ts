// ============================================================================
// ApplicationsController — postulación de especialista (pantallas 9→13)
// ============================================================================
//   POST   /applications            (PÚBLICO, multipart)  → enviar postulación
//   GET    /applications            (ADMIN)               → cola de revisión
//   GET    /applications/:id        (ADMIN)               → detalle + docs
//   PATCH  /applications/:id/approve(ADMIN)               → aprobar (checklist)
//   PATCH  /applications/:id/reject (ADMIN)               → rechazar (motivo)
// La activación de la cuenta (crear contraseña) está en POST /auth/activate-specialist.
// ============================================================================

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ApplicationStatus, UserRole } from '@prisma/client';

import { ApplicationsService, UploadedMulterFile } from './applications.service';
import {
  SubmitApplicationDto,
  ApproveApplicationDto,
  RejectApplicationDto,
} from './dto/applications.dto';
import { Public, Roles, CurrentUser, ClientIp, AuthUser } from '../common/decorators';

const MAX_DOC_BYTES = 4 * 1024 * 1024; // 4 MB por documento

@ApiTags('Postulaciones')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  // --------------------------------------------------------------------------
  // POST /applications — enviar postulación (público, multipart: cv + dni)
  // --------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 postulaciones/min por IP
  @Post()
  @ApiOperation({ summary: 'Enviar postulación de especialista (NO crea cuenta)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cv', maxCount: 1 },
        { name: 'dni', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_DOC_BYTES, files: 2 } },
    ),
  )
  async submit(
    @Body() dto: SubmitApplicationDto,
    @UploadedFiles() files: { cv?: UploadedMulterFile[]; dni?: UploadedMulterFile[] } | undefined,
    @ClientIp() ip: string,
    @Req() req: Request,
  ): Promise<{ message: string; applicationId: string }> {
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.applications.submit(dto, files?.cv?.[0], files?.dni?.[0], ip, userAgent);
  }

  // --------------------------------------------------------------------------
  // GET /applications?status=PENDING — cola de revisión (admin)
  // --------------------------------------------------------------------------
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar postulaciones (admin), filtrable por estado' })
  list(@Query('status') statusRaw?: string) {
    const status =
      statusRaw && (Object.values(ApplicationStatus) as string[]).includes(statusRaw)
        ? (statusRaw as ApplicationStatus)
        : undefined;
    return this.applications.listForAdmin(status);
  }

  // --------------------------------------------------------------------------
  // GET /applications/:id — detalle + tokens de descarga de documentos (admin)
  // --------------------------------------------------------------------------
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Detalle de una postulación con documentos (admin)' })
  getOne(@Param('id') id: string) {
    return this.applications.getOneForAdmin(id);
  }

  // --------------------------------------------------------------------------
  // PATCH /applications/:id/approve — aprobar (requiere checklist completo)
  // --------------------------------------------------------------------------
  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar postulación (crea cuenta + activación)' })
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: ApproveApplicationDto,
    @ClientIp() ip: string,
  ) {
    return this.applications.approve(id, admin.sub, dto, ip);
  }

  // --------------------------------------------------------------------------
  // PATCH /applications/:id/reject — rechazar (con motivo)
  // --------------------------------------------------------------------------
  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar postulación (con motivo)' })
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: RejectApplicationDto,
    @ClientIp() ip: string,
  ) {
    return this.applications.reject(id, admin.sub, dto, ip);
  }
}
