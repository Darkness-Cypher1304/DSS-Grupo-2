// ============================================================================
// StorageService — almacenamiento de archivos en PostgreSQL (reemplaza MinIO)
// ============================================================================
// MinIO no existe en Render free-tier y no se permiten servicios nuevos. Este
// proveedor guarda el binario en la BD (tabla file_objects, bytea) PRESERVANDO
// las capacidades de seguridad que ofrecía MinIO:
//   - Whitelist de mime types + validación de MAGIC BYTES antes de persistir
//     (no se confía en el mimeType del cliente)                         → RF-26
//   - Hash SHA-256 de integridad                                        → RF-27
//   - Tope de tamaño configurable (STORAGE_MAX_BYTES, def. 4MB)
//   - Nombre de archivo sanitizado
//   - Descarga tipo "presigned URL" mediante tokens HMAC efímeros       → RF-25/28
//
// Diseñado como abstracción: para migrar a S3/MinIO/Supabase mañana basta con
// reimplementar estos métodos; los controllers no cambian.
// ============================================================================

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { constantTimeEqual } from '../common/security/constant-time';

export type StorageFolder = 'specialist-docs' | 'resources' | 'avatars';
export const STORAGE_FOLDERS: StorageFolder[] = ['specialist-docs', 'resources', 'avatars'];

export interface StoredFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface FilePayload {
  data: Buffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  ownerId: string | null;
  folder: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly maxBytes: number;
  private readonly tokenSecret: string;

  // Lista BLANCA de mime types permitidos
  private readonly ALLOWED_MIME_TYPES = new Set<string>([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  // Firmas (magic bytes) por tipo
  private readonly MAGIC_BYTES: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xe2],
      [0xff, 0xd8, 0xff, 0xe3],
      [0xff, 0xd8, 0xff, 0xdb],
    ],
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (+ "WEBP" en bytes 8..11)
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.maxBytes = parseInt(
      this.config.get<string>('STORAGE_MAX_BYTES', String(4 * 1024 * 1024)),
      10,
    );
    // Secreto para firmar tokens de descarga. Reusa el del JWT si no hay uno
    // dedicado (en prod siempre hay JWT_ACCESS_SECRET).
    this.tokenSecret =
      this.config.get<string>('STORAGE_TOKEN_SECRET') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'neuroalert-dev-storage-secret';
  }

  get maxFileBytes(): number {
    return this.maxBytes;
  }

  isAllowedMime(mime: string): boolean {
    return this.ALLOWED_MIME_TYPES.has(mime);
  }

  // --------------------------------------------------------------------------
  // Guardar un archivo (valida whitelist + magic bytes + tamaño, hashea SHA-256)
  // --------------------------------------------------------------------------
  async storeFile(
    buffer: Buffer,
    originalName: string,
    declaredMime: string,
    folder: StorageFolder,
    ownerId?: string,
  ): Promise<StoredFileMeta> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }
    if (buffer.length > this.maxBytes) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo permitido (${Math.round(this.maxBytes / 1024 / 1024)} MB).`,
      );
    }
    if (!this.ALLOWED_MIME_TYPES.has(declaredMime)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${declaredMime}`);
    }
    // RF-26: el servidor NO confía en el mimeType del cliente — valida los bytes.
    if (!this.matchesMagicBytes(buffer, declaredMime)) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con el tipo declarado. Archivo rechazado.',
      );
    }
    // WebP: además del RIFF inicial, exige "WEBP" en los bytes 8..11.
    if (declaredMime === 'image/webp' && buffer.slice(8, 12).toString('ascii') !== 'WEBP') {
      throw new BadRequestException('El archivo WebP no es válido.');
    }

    const sha256 = createHash('sha256').update(buffer).digest('hex'); // RF-27
    const fileName = this.sanitizeFileName(originalName);

    const file = await this.prisma.fileObject.create({
      data: {
        folder,
        fileName,
        mimeType: declaredMime,
        sizeBytes: buffer.length,
        sha256,
        data: buffer,
        ownerId: ownerId ?? null,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true },
    });

    this.logger.log(`Archivo almacenado ${file.id} (${file.sizeBytes} B, ${declaredMime})`);
    return file;
  }

  // --------------------------------------------------------------------------
  // Leer el binario completo (para descarga)
  // --------------------------------------------------------------------------
  async getFile(id: string): Promise<FilePayload> {
    const file = await this.prisma.fileObject.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    return {
      data: Buffer.from(file.data),
      mimeType: file.mimeType,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      ownerId: file.ownerId,
      folder: file.folder,
    };
  }

  // Metadatos sin el binario (para chequear autorización antes de servir)
  async getMeta(id: string) {
    return this.prisma.fileObject.findUnique({
      where: { id },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, ownerId: true, folder: true },
    });
  }

  async deleteFile(id: string): Promise<void> {
    await this.prisma.fileObject.delete({ where: { id } }).catch(() => undefined);
  }

  // --------------------------------------------------------------------------
  // "Presigned URL" emulada: token HMAC con expiración (RF-25 / RF-28)
  // --------------------------------------------------------------------------
  createDownloadToken(id: string, ttlSeconds = 900): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${id}.${exp}`;
    return Buffer.from(`${payload}.${this.sign(payload)}`).toString('base64url');
  }

  verifyDownloadToken(token: string): string {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Token de descarga inválido');
    }
    const parts = decoded.split('.');
    if (parts.length !== 3) throw new BadRequestException('Token de descarga inválido');
    const [id, expStr, sig] = parts;
    if (!constantTimeEqual(this.sign(`${id}.${expStr}`), sig)) {
      throw new BadRequestException('Token de descarga inválido');
    }
    if (parseInt(expStr, 10) < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('El enlace de descarga expiró');
    }
    return id;
  }

  // --------------------------------------------------------------------------
  // Helpers privados
  // --------------------------------------------------------------------------
  private sign(payload: string): string {
    return createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
  }

  private matchesMagicBytes(buffer: Buffer, mime: string): boolean {
    const signatures = this.MAGIC_BYTES[mime];
    if (!signatures || signatures.length === 0) return false;
    return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
  }

  private sanitizeFileName(name: string): string {
    const DIACRITICS = /[̀-ͯ]/g; // marcas combinantes tras NFD
    const cleaned = (name || 'archivo')
      .normalize('NFD')
      .replace(DIACRITICS, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
    return cleaned.length > 0 ? cleaned : 'archivo';
  }
}
