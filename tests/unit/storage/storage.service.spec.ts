// ============================================================================
// Unit · StorageService — whitelist mime + magic bytes + SHA-256 + tokens HMAC
// ============================================================================

import { BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageService } from '../../../src/storage/storage.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';

const configMock = {
  get: (key: string, def?: unknown) => process.env[key] ?? def,
} as unknown as ConfigService;

// Cabeceras "magic bytes" válidas
const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('contenido pdf')]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe('StorageService', () => {
  let prisma: PrismaMock;
  let service: StorageService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StorageService(prisma, configMock);
  });

  describe('storeFile — validaciones', () => {
    it('rechaza un archivo vacío', async () => {
      await expect(
        service.storeFile(Buffer.alloc(0), 'x.pdf', 'application/pdf', 'resources'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si supera el tamaño máximo', async () => {
      const big = Buffer.alloc(service.maxFileBytes + 1);
      big[0] = 0x25;
      await expect(
        service.storeFile(big, 'x.pdf', 'application/pdf', 'resources'),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rechaza un mime no permitido', async () => {
      await expect(
        service.storeFile(PDF, 'x.exe', 'application/x-msdownload', 'resources'),
      ).rejects.toThrow(/no permitido/i);
    });

    it('rechaza si los magic bytes no coinciden con el mime declarado', async () => {
      const fakePdf = Buffer.from('esto no es un pdf');
      await expect(
        service.storeFile(fakePdf, 'x.pdf', 'application/pdf', 'resources'),
      ).rejects.toThrow(/no coincide/i);
    });

    it('almacena un PDF válido con hash SHA-256 y nombre saneado', async () => {
      prisma.fileObject.create.mockResolvedValue({
        id: 'f1',
        fileName: 'archivo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: PDF.length,
        sha256: 'deadbeef',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const meta = await service.storeFile(PDF, 'árchivo raro!.pdf', 'application/pdf', 'specialist-docs', 'owner-1');

      expect(prisma.fileObject.create).toHaveBeenCalled();
      const data = prisma.fileObject.create.mock.calls[0][0].data;
      expect(data.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(data.fileName).not.toMatch(/[^a-zA-Z0-9._-]/);
      expect(meta.id).toBe('f1');
    });

    it('acepta también PNG por magic bytes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fileObject.create.mockResolvedValue({ id: 'f2' } as any);
      await expect(
        service.storeFile(PNG, 'img.png', 'image/png', 'avatars'),
      ).resolves.toBeDefined();
    });

    it('acepta WebP válido (RIFF + "WEBP" en bytes 8..11)', async () => {
      const webp = Buffer.concat([
        Buffer.from([0x52, 0x49, 0x46, 0x46]),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from('WEBP'),
        Buffer.from('datos'),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fileObject.create.mockResolvedValue({ id: 'f3' } as any);
      await expect(service.storeFile(webp, 'i.webp', 'image/webp', 'avatars')).resolves.toBeDefined();
    });

    it('rechaza un WebP con RIFF pero sin la firma "WEBP"', async () => {
      const fakeWebp = Buffer.concat([
        Buffer.from([0x52, 0x49, 0x46, 0x46]),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from('XXXX'),
      ]);
      await expect(
        service.storeFile(fakeWebp, 'i.webp', 'image/webp', 'avatars'),
      ).rejects.toThrow(/WebP no es válido/i);
    });
  });

  describe('getFile / getMeta / deleteFile', () => {
    it('getFile lanza 404 si no existe', async () => {
      prisma.fileObject.findUnique.mockResolvedValue(null);
      await expect(service.getFile('nope')).rejects.toThrow(NotFoundException);
    });

    it('getFile devuelve el binario y metadatos', async () => {
      prisma.fileObject.findUnique.mockResolvedValue({
        data: Buffer.from('abc'),
        mimeType: 'application/pdf',
        fileName: 'a.pdf',
        sizeBytes: 3,
        ownerId: 'o1',
        folder: 'resources',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const file = await service.getFile('f1');
      expect(file.mimeType).toBe('application/pdf');
      expect(file.data.toString()).toBe('abc');
    });

    it('deleteFile no lanza aunque el registro no exista', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fileObject.delete.mockResolvedValue({} as any);
      await expect(service.deleteFile('f1')).resolves.toBeUndefined();
    });
  });

  describe('tokens de descarga (HMAC + expiración)', () => {
    it('crea y verifica un token válido (round-trip)', () => {
      const token = service.createDownloadToken('file-123', 900);
      expect(service.verifyDownloadToken(token)).toBe('file-123');
    });

    it('rechaza un token manipulado', () => {
      const token = service.createDownloadToken('file-123', 900);
      const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
      expect(() => service.verifyDownloadToken(tampered)).toThrow(BadRequestException);
    });

    it('rechaza un token expirado', () => {
      const token = service.createDownloadToken('file-123', -10); // exp en el pasado
      expect(() => service.verifyDownloadToken(token)).toThrow(/expiró/i);
    });

    it('rechaza un token con formato inválido', () => {
      expect(() => service.verifyDownloadToken('no-es-un-token')).toThrow(BadRequestException);
    });
  });

  describe('helpers públicos', () => {
    it('isAllowedMime distingue permitidos de no permitidos', () => {
      expect(service.isAllowedMime('application/pdf')).toBe(true);
      expect(service.isAllowedMime('text/html')).toBe(false);
    });
  });
});
