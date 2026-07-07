// ============================================================================
// Unit · ContentService — flujo editorial (DRAFT→PENDING→PUBLISHED), IDOR, slug
// ============================================================================

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentStatus, UserRole } from '@prisma/client';

import { ContentService } from '../../../src/content/content.service';
import { AuditService } from '../../../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { USER_IDS } from '../../fixtures/users.fixture';

describe('ContentService', () => {
  let prisma: PrismaMock;
  let audit: { log: jest.Mock };
  let service: ContentService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: jest.fn() };
    service = new ContentService(prisma, audit as unknown as AuditService);
  });

  describe('listPublished', () => {
    it('devuelve items y paginación', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findMany.mockResolvedValue([{ id: 'c1' }] as any);
      prisma.content.count.mockResolvedValue(1);

      const res = await service.listPublished(undefined, 1, 12);

      expect(res.items).toHaveLength(1);
      expect(res.pagination).toMatchObject({ total: 1, totalPages: 1 });
    });

    it('filtra por categoría cuando se indica', async () => {
      prisma.content.findMany.mockResolvedValue([]);
      prisma.content.count.mockResolvedValue(0);
      await service.listPublished('guias', 1, 12);
      expect(prisma.content.findMany.mock.calls[0][0]!.where).toEqual(
        expect.objectContaining({ category: 'guias' }),
      );
    });
  });

  describe('getBySlug', () => {
    it('lanza 404 si no existe o no está publicado', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(null);
      await expect(service.getBySlug('x')).rejects.toThrow(NotFoundException);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValueOnce({ id: 'c1', status: ContentStatus.DRAFT } as any);
      await expect(service.getBySlug('x')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el publicado e incrementa vistas (fire-and-forget)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', status: ContentStatus.PUBLISHED } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({} as any);

      const res = await service.getBySlug('slug');

      expect(res).toMatchObject({ id: 'c1' });
      expect(prisma.content.update).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = { title: 'Señales de TEA', summary: 's', body: 'b', category: 'guias', tags: [] };

    it('genera slug único, crea DRAFT y audita', async () => {
      prisma.content.findUnique.mockResolvedValue(null); // slug libre
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.create.mockResolvedValue({ id: 'c1' } as any);

      const res = await service.create(USER_IDS.specialist, dto, '1.1.1.1');

      const arg = prisma.content.create.mock.calls[0][0];
      expect(arg.data.status).toBe(ContentStatus.DRAFT);
      expect(arg.data.slug).toBe('senales-de-tea');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTENT_CREATED' }));
      expect(res).toMatchObject({ id: 'c1' });
    });

    it('agrega sufijo al slug si ya existe', async () => {
      prisma.content.findUnique
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: 'ocupado' } as any)
        .mockResolvedValueOnce(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.create.mockResolvedValue({ id: 'c2' } as any);

      await service.create(USER_IDS.specialist, dto, '1.1.1.1');

      expect(prisma.content.create.mock.calls[0][0].data.slug).toMatch(/-1$/);
    });
  });

  describe('update (IDOR + re-revisión)', () => {
    it('lanza 404 si no existe', async () => {
      prisma.content.findUnique.mockResolvedValue(null);
      await expect(
        service.update(USER_IDS.specialist, UserRole.SPECIALIST, 'c1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 403 si no es el autor ni admin', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: 'otro', status: ContentStatus.DRAFT } as any);
      await expect(
        service.update(USER_IDS.specialist, UserRole.SPECIALIST, 'c1', { title: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un artículo PUBLICADO que se edita vuelve a PENDING', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: USER_IDS.specialist, status: ContentStatus.PUBLISHED } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({} as any);

      await service.update(USER_IDS.specialist, UserRole.SPECIALIST, 'c1', { title: 'x' });

      expect(prisma.content.update.mock.calls[0][0].data.status).toBe(ContentStatus.PENDING);
    });

    it('un artículo NO publicado conserva su estado al editarse', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: USER_IDS.specialist, status: ContentStatus.DRAFT } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({} as any);
      await service.update(USER_IDS.specialist, UserRole.SPECIALIST, 'c1', { title: 'nuevo' });
      expect(prisma.content.update.mock.calls[0][0].data.status).toBe(ContentStatus.DRAFT);
    });
  });

  describe('submitForReview', () => {
    it('lanza 403 si no es el autor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: 'otro' } as any);
      await expect(service.submitForReview(USER_IDS.specialist, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('pasa a PENDING si es el autor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findUnique.mockResolvedValue({ id: 'c1', authorId: USER_IDS.specialist } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({} as any);

      await service.submitForReview(USER_IDS.specialist, 'c1');

      expect(prisma.content.update.mock.calls[0][0].data.status).toBe(ContentStatus.PENDING);
    });
  });

  describe('changeStatus (admin)', () => {
    it('publica y audita CONTENT_PUBLISHED', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({ id: 'c1' } as any);

      await service.changeStatus(USER_IDS.admin, 'c1', { status: ContentStatus.PUBLISHED }, '1.1.1.1');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONTENT_PUBLISHED' }),
      );
    });

    it('cambiar a un estado no publicado NO audita publicación', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({ id: 'c1' } as any);

      await service.changeStatus(USER_IDS.admin, 'c1', { status: ContentStatus.DRAFT }, '1.1.1.1');

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('publicar fija publishedAt con la fecha actual', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({ id: 'c1' } as any);

      await service.changeStatus(USER_IDS.admin, 'c1', { status: ContentStatus.PUBLISHED }, '1.1.1.1');

      const dataArg = prisma.content.update.mock.calls[0][0].data;
      expect(dataArg.publishedAt).toBeInstanceOf(Date);
    });

    it('archivar un artículo NO toca publishedAt (no borra la fecha original) — H5', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({ id: 'c1' } as any);

      await service.changeStatus(USER_IDS.admin, 'c1', { status: ContentStatus.ARCHIVED }, '1.1.1.1');

      const dataArg = prisma.content.update.mock.calls[0][0].data;
      // Antes ponía publishedAt: null (borraba la fecha). Ahora ni siquiera
      // incluye el campo en la transición a ARCHIVED.
      expect(dataArg).not.toHaveProperty('publishedAt');
    });
  });

  describe('softDelete', () => {
    it('marca deletedAt y audita CONTENT_DELETED', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.update.mockResolvedValue({} as any);

      const res = await service.softDelete(USER_IDS.admin, 'c1', '1.1.1.1');

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTENT_DELETED' }));
      expect(res.message).toMatch(/eliminado/i);
    });
  });

  describe('listMyContent / listPendingReview', () => {
    it('lista el contenido del autor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findMany.mockResolvedValue([{ id: 'c1' }] as any);
      await expect(service.listMyContent(USER_IDS.specialist)).resolves.toHaveLength(1);
    });

    it('lista lo pendiente de revisión', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.content.findMany.mockResolvedValue([{ id: 'c1' }] as any);
      await expect(service.listPendingReview()).resolves.toHaveLength(1);
    });
  });
});
