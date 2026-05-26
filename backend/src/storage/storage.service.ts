// ============================================================================
// StorageService — MinIO (S3-compatible)
// ============================================================================
// Maneja uploads de PDFs/imágenes con:
//   - Presigned URLs (TTL 15 min) — el frontend sube directamente a MinIO
//   - Validación de magic bytes (no confiar en mimetype del cliente)
//   - SHA-256 hash para verificar integridad
// ============================================================================

import { Global, Injectable, Logger, Module, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { createHash, randomUUID } from 'crypto';

interface UploadInfo {
  key: string;
  presignedUrl: string;
  expiresInSeconds: number;
}

interface ValidatedFile {
  mimeType: string;
  hash: string;
  size: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Client;
  private bucketName!: string;
  private presignedTtl!: number;

  // Lista BLANCA de mime types permitidos
  private readonly ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  // Magic bytes (header signatures) por tipo de archivo
  private readonly MAGIC_BYTES: { [k: string]: number[][] } = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xe2],
      [0xff, 0xd8, 0xff, 0xe3],
      [0xff, 0xd8, 0xff, 0xdb],
    ],
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (luego WEBP en bytes 8-11)
  };

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'minio'),
      port: parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ROOT_USER')!,
      secretKey: this.config.get<string>('MINIO_ROOT_PASSWORD')!,
    });

    this.bucketName = this.config.get<string>('MINIO_BUCKET_NAME', 'neuroalert-resources');
    this.presignedTtl = parseInt(this.config.get<string>('MINIO_PRESIGNED_URL_TTL', '900'), 10);

    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        this.logger.log(`✅ Bucket "${this.bucketName}" creado`);
      } else {
        this.logger.log(`✅ Bucket "${this.bucketName}" disponible`);
      }
    } catch (err) {
      this.logger.error(`Error inicializando bucket: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Generar URL pre-firmada para upload (PUT directo desde el cliente)
  // --------------------------------------------------------------------------
  async getPresignedUploadUrl(
    originalFileName: string,
    folder: 'resources' | 'specialist-docs' | 'avatars',
  ): Promise<UploadInfo> {
    const sanitized = this.sanitizeFileName(originalFileName);
    const key = `${folder}/${randomUUID()}-${sanitized}`;
    const presignedUrl = await this.client.presignedPutObject(
      this.bucketName,
      key,
      this.presignedTtl,
    );
    return { key, presignedUrl, expiresInSeconds: this.presignedTtl };
  }

  // --------------------------------------------------------------------------
  // Generar URL pre-firmada para download
  // --------------------------------------------------------------------------
  async getPresignedDownloadUrl(key: string): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, key, this.presignedTtl);
  }

  // --------------------------------------------------------------------------
  // Eliminar archivo
  // --------------------------------------------------------------------------
  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucketName, key);
  }

  // --------------------------------------------------------------------------
  // Validar magic bytes de un archivo subido (verificación post-upload)
  // --------------------------------------------------------------------------
  async validateUploadedFile(key: string, declaredMimeType: string): Promise<ValidatedFile> {
    if (!this.ALLOWED_MIME_TYPES.has(declaredMimeType)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${declaredMimeType}`);
    }

    // Descargar primeros bytes para verificar magic
    const stream = await this.client.getPartialObject(this.bucketName, key, 0, 16);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const header = Buffer.concat(chunks).slice(0, 16);

    const expectedSignatures = this.MAGIC_BYTES[declaredMimeType];
    if (!expectedSignatures || expectedSignatures.length === 0) {
      throw new BadRequestException('No se puede validar este tipo de archivo');
    }

    const matches = expectedSignatures.some((sig) =>
      sig.every((byte, i) => header[i] === byte),
    );
    if (!matches) {
      // Magic bytes no coinciden — archivo sospechoso, eliminarlo
      await this.deleteObject(key);
      throw new BadRequestException(
        'El contenido del archivo no coincide con el tipo declarado. Archivo rechazado.',
      );
    }

    // Calcular hash SHA-256 completo
    const fullStream = await this.client.getObject(this.bucketName, key);
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of fullStream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      size += buf.length;
    }

    return {
      mimeType: declaredMimeType,
      hash: hash.digest('hex'),
      size,
    };
  }

  // --------------------------------------------------------------------------
  // Sanitizar nombre de archivo (quitar caracteres peligrosos)
  // --------------------------------------------------------------------------
  private sanitizeFileName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
  }
}

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
