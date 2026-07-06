// ============================================================================
// Integration · Storage — subida con autorización por carpeta y descarga
// ============================================================================

import request from 'supertest';
import { UserRole } from '@prisma/client';

import { buildApp, resetAppMocks, authAs, TestApp } from '../../helpers/integration';

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('-1.4 contenido')]);

describe('Storage (integration)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await buildApp();
  });
  afterEach(() => resetAppMocks(ctx));
  afterAll(async () => {
    await ctx.app.close();
  });

  it('POST /api/storage/upload → 403 si un PARENT sube a "resources"', async () => {
    const res = await http()
      .post('/api/storage/upload')
      .set('Authorization', authAs(UserRole.PARENT))
      .field('folder', 'resources')
      .attach('file', PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('POST /api/storage/upload → 201 con SPECIALIST y PDF válido', async () => {
    ctx.prisma.fileObject.create.mockResolvedValue({
      id: 'f1',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      sha256: 'abc',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await http()
      .post('/api/storage/upload')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .field('folder', 'specialist-docs')
      .attach('file', PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'f1' });
    expect(res.body.data.downloadToken).toBeTruthy();
  });

  it('GET /api/storage/:id → 404 si no existe', async () => {
    ctx.prisma.fileObject.findUnique.mockResolvedValue(null);
    const res = await http().get('/api/storage/nope').set('Authorization', authAs(UserRole.ADMIN));
    expect(res.status).toBe(404);
  });

  it('GET /api/storage/:id → 200 al descargar un recurso público', async () => {
    ctx.prisma.fileObject.findUnique
      .mockResolvedValueOnce({
        id: 'f1',
        ownerId: null,
        folder: 'resources',
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .mockResolvedValueOnce({
        data: Buffer.from('abc'),
        mimeType: 'application/pdf',
        fileName: 'a.pdf',
        sizeBytes: 3,
        ownerId: null,
        folder: 'resources',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    const res = await http().get('/api/storage/f1').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(200);
  });

  it('GET /api/storage/token/:token → 400 con token inválido (público)', async () => {
    const res = await http().get('/api/storage/token/token-invalido');
    expect(res.status).toBe(400);
  });

  it('POST /api/storage/upload → 400 con carpeta inválida', async () => {
    const res = await http()
      .post('/api/storage/upload')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .field('folder', 'carpeta-mala')
      .attach('file', PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('GET /api/storage/:id → 404 si no es dueño ni recurso público', async () => {
    ctx.prisma.fileObject.findUnique.mockResolvedValue({
      id: 'f1',
      ownerId: 'otro-usuario',
      folder: 'specialist-docs',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const res = await http().get('/api/storage/f1').set('Authorization', authAs(UserRole.PARENT));
    expect(res.status).toBe(404);
  });

  it('presigned: subir y descargar por token efímero', async () => {
    ctx.prisma.fileObject.create.mockResolvedValue({
      id: 'f1',
      fileName: 'd.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      sha256: 'x',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const up = await http()
      .post('/api/storage/upload')
      .set('Authorization', authAs(UserRole.SPECIALIST))
      .field('folder', 'specialist-docs')
      .attach('file', PDF, { filename: 'd.pdf', contentType: 'application/pdf' });
    const token = up.body.data.downloadToken;

    ctx.prisma.fileObject.findUnique.mockResolvedValue({
      data: Buffer.from('abc'),
      mimeType: 'application/pdf',
      fileName: 'd.pdf',
      sizeBytes: 3,
      ownerId: 'x',
      folder: 'specialist-docs',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const dl = await http().get(`/api/storage/token/${token}`);
    expect(dl.status).toBe(200);
  });
});
