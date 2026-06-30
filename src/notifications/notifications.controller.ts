// ============================================================================
// NotificationsController — notificaciones in-app (RF-34)
// ============================================================================
// Todos los endpoints requieren JWT (guard global). Cada usuario opera SOBRE
// SUS PROPIAS notificaciones: el service filtra siempre por user.sub, así que
// no hace falta un @Roles — sirve a PARENT / SPECIALIST / ADMIN por igual.
// Polling: el frontend consulta /unread-count cada ~30s (sin WebSocket).
// ============================================================================

import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthUser } from '../common/decorators';

@ApiTags('Notificaciones')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis notificaciones (más recientes primero)' })
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.sub, user.role);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contador de notificaciones no leídas (para el polling de la campana)' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.sub, user.role);
  }

  // Estática antes que ':id/read' para evitar cualquier ambigüedad de ruteo.
  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.sub, user.role);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación propia como leída' })
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, user.role, id);
  }
}
