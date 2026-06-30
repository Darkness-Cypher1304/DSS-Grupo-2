// ============================================================================
// NotificationsService — notificaciones in-app por polling (RF-34)
// ============================================================================
// Dos planos de acceso, a propósito:
//   1. createForUser(): se invoca a NIVEL SISTEMA cuando ocurre un evento
//      (p.ej. un especialista responde una consulta). La conexión es del dueño
//      de la BD → la fila se inserta a nombre del DESTINATARIO. No se contextua
//      al actor, que normalmente NO es el destinatario.
//   2. Lectura/marcado: SIEMPRE en el contexto del usuario dueño
//      (runWithUserContext) y filtrando explícitamente por userId en la capa de
//      aplicación. Doble cierre de IDOR (OWASP A01), independiente del RLS.
// ============================================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  relatedType?: string;
  relatedId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Cuántas notificaciones devuelve el listado (la campana solo muestra las recientes).
  private static readonly LIST_LIMIT = 30;

  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // SISTEMA: crear una notificación para un usuario.
  // Best-effort — el caller decide si envolver en try/catch (un fallo aquí no
  // debe tumbar el flujo de negocio que la disparó, p.ej. responder una consulta).
  // --------------------------------------------------------------------------
  async createForUser(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
      },
      select: { id: true, type: true, title: true, createdAt: true },
    });
  }

  // --------------------------------------------------------------------------
  // USUARIO: listar SUS notificaciones (más recientes primero).
  // --------------------------------------------------------------------------
  async listForUser(userId: string, role: string) {
    return this.prisma.runWithUserContext(userId, role, async (tx) => {
      return tx.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: NotificationsService.LIST_LIMIT,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          relatedType: true,
          relatedId: true,
          isRead: true,
          createdAt: true,
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // USUARIO: contador de no leídas (lo que consulta el polling de la campana).
  // --------------------------------------------------------------------------
  async unreadCount(userId: string, role: string) {
    return this.prisma.runWithUserContext(userId, role, async (tx) => {
      const count = await tx.notification.count({ where: { userId, isRead: false } });
      return { count };
    });
  }

  // --------------------------------------------------------------------------
  // USUARIO: marcar una notificación propia como leída.
  // updateMany con where { id, userId } garantiza que solo se toque la propia
  // (no revela existencia de notificaciones ajenas: 404 si no es suya).
  // --------------------------------------------------------------------------
  async markRead(userId: string, role: string, id: string) {
    return this.prisma.runWithUserContext(userId, role, async (tx) => {
      const res = await tx.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });
      if (res.count === 0) throw new NotFoundException('Notificación no encontrada');
      return { updated: res.count };
    });
  }

  // --------------------------------------------------------------------------
  // USUARIO: marcar todas las propias como leídas.
  // --------------------------------------------------------------------------
  async markAllRead(userId: string, role: string) {
    return this.prisma.runWithUserContext(userId, role, async (tx) => {
      const res = await tx.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return { updated: res.count };
    });
  }
}
