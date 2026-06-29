// ============================================================================
// ContentService
// ============================================================================

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateContentDto,
  UpdateContentDto,
  ChangeContentStatusDto,
} from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------------------------
  // PÚBLICO: listar artículos publicados (cualquier visitante)
  // --------------------------------------------------------------------------
  async listPublished(category?: string, page = 1, perPage = 12) {
    const where = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          category: true,
          tags: true,
          coverImageKey: true,
          publishedAt: true,
          author: { select: { fullName: true } },
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getBySlug(slug: string) {
    const content = await this.prisma.content.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            specialistProfile: { select: { specialty: true, institution: true } },
          },
        },
      },
    });

    if (!content || content.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Artículo no encontrado');
    }

    // Incrementar vista (no esperamos al resultado)
    this.prisma.content.update({
      where: { id: content.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => null);

    return content;
  }

  // --------------------------------------------------------------------------
  // ESPECIALISTA: crear borrador
  // --------------------------------------------------------------------------
  async create(authorId: string, dto: CreateContentDto, ip: string) {
    const slug = await this.generateUniqueSlug(dto.title);

    const content = await this.prisma.content.create({
      data: {
        authorId,
        title: dto.title,
        slug,
        summary: dto.summary,
        body: dto.body,
        category: dto.category,
        tags: dto.tags || [],
        status: ContentStatus.DRAFT,
      },
    });

    await this.audit.log({
      userId: authorId,
      action: 'CONTENT_CREATED',
      entityType: 'Content',
      entityId: content.id,
      ipAddress: ip,
      success: true,
    });

    return content;
  }

  async listMyContent(authorId: string) {
    return this.prisma.content.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(authorId: string, role: UserRole, contentId: string, dto: UpdateContentDto) {
    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException('Artículo no encontrado');

    // Solo el autor o un admin pueden actualizar
    if (content.authorId !== authorId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permiso para editar este artículo');
    }

    return this.prisma.content.update({
      where: { id: contentId },
      data: {
        ...dto,
        // Si se modifica un artículo publicado, vuelve a PENDING
        status:
          content.status === ContentStatus.PUBLISHED ? ContentStatus.PENDING : content.status,
      },
    });
  }

  async submitForReview(authorId: string, contentId: string) {
    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException('Artículo no encontrado');
    if (content.authorId !== authorId) throw new ForbiddenException('No autorizado');

    return this.prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.PENDING },
    });
  }

  // --------------------------------------------------------------------------
  // ADMIN: cambiar status (publicar/archivar/rechazar)
  // --------------------------------------------------------------------------
  async changeStatus(adminId: string, contentId: string, dto: ChangeContentStatusDto, ip: string) {
    const content = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: dto.status,
        reviewedById: adminId,
        reviewNotes: dto.reviewNotes,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });

    if (dto.status === ContentStatus.PUBLISHED) {
      await this.audit.log({
        userId: adminId,
        action: 'CONTENT_PUBLISHED',
        entityType: 'Content',
        entityId: contentId,
        ipAddress: ip,
        success: true,
      });
    }

    return content;
  }

  async listPendingReview() {
    return this.prisma.content.findMany({
      where: { status: ContentStatus.PENDING, deletedAt: null },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async softDelete(adminId: string, contentId: string, ip: string) {
    await this.prisma.content.update({
      where: { id: contentId },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: adminId,
      action: 'CONTENT_DELETED',
      entityType: 'Content',
      entityId: contentId,
      ipAddress: ip,
      success: true,
    });

    return { message: 'Artículo eliminado' };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = this.slugify(title);
    let slug = base;
    let counter = 1;
    while (await this.prisma.content.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter += 1;
    }
    return slug;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/[^a-z0-9\s-]/g, '')    // solo alfanuméricos, espacios y guiones
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);
  }
}
