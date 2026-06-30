// ============================================================================
// StorageController — subida y descarga de archivos (RF-25..28)
// ============================================================================
// Subida controlada por el backend (valida magic-bytes + SHA-256 + whitelist +
// tamaño) y descarga con dos modos:
//   - GET /storage/:id          → autenticada, con autorización (dueño/ADMIN, o
//                                 carpeta 'resources' pública entre usuarios).
//   - GET /storage/token/:token → "presigned": token HMAC efímero, sin sesión.
// El control de acceso vive en esta capa (RLS está en NO FORCE; ver migración).
// ============================================================================

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { StorageService, STORAGE_FOLDERS, StorageFolder, FilePayload } from './storage.service';
import { Public, CurrentUser, AuthUser } from '../common/decorators';

// Tipado mínimo del archivo que inyecta multer (evita depender de @types/multer).
interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Almacenamiento')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  // --------------------------------------------------------------------------
  // POST /storage/upload  (autenticado, multipart/form-data)
  // --------------------------------------------------------------------------
  @Post('upload')
  @ApiOperation({ summary: 'Subir un archivo (PDF/JPEG/PNG/WebP, máx. 4MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 4 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body('folder') folderRaw: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');

    const folder = this.normalizeFolder(folderRaw);

    // Subir a 'resources' (contenido público) queda reservado a especialistas/admin.
    if (folder === 'resources' && user.role !== UserRole.SPECIALIST && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No autorizado para subir recursos públicos.');
    }

    const meta = await this.storage.storeFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
      user.sub,
    );

    return {
      ...meta,
      // Token de descarga efímero (útil para previsualizar lo recién subido).
      downloadToken: this.storage.createDownloadToken(meta.id),
    };
  }

  // --------------------------------------------------------------------------
  // GET /storage/:id  (autenticado, con autorización)
  // --------------------------------------------------------------------------
  @Get(':id')
  @ApiOperation({ summary: 'Descargar un archivo (dueño/ADMIN, o recurso público)' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const meta = await this.storage.getMeta(id);
    // 404 (no 403) para no revelar la existencia del recurso ajeno.
    if (!meta) throw new NotFoundException('Archivo no encontrado');

    const canView =
      user.role === UserRole.ADMIN ||
      meta.ownerId === user.sub ||
      meta.folder === 'resources';
    if (!canView) throw new NotFoundException('Archivo no encontrado');

    const file = await this.storage.getFile(id);
    this.sendFile(res, file);
  }

  // --------------------------------------------------------------------------
  // GET /storage/token/:token  (público, "presigned" con expiración)
  // --------------------------------------------------------------------------
  @Public()
  @Get('token/:token')
  @ApiOperation({ summary: 'Descargar con token efímero (sin sesión)' })
  async downloadByToken(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const id = this.storage.verifyDownloadToken(token); // lanza si inválido/expirado
    const file = await this.storage.getFile(id);
    this.sendFile(res, file);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  private normalizeFolder(folderRaw: string | undefined): StorageFolder {
    const folder = (folderRaw || 'specialist-docs') as StorageFolder;
    if (!STORAGE_FOLDERS.includes(folder)) {
      throw new BadRequestException('Carpeta de destino inválida.');
    }
    return folder;
  }

  private sendFile(res: Response, file: FilePayload): void {
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.data);
  }
}
