// ============================================================================
// NotificationsModule — notificaciones in-app por polling (RF-34)
// ============================================================================
// @Global para que NotificationsService pueda inyectarse donde se disparan los
// eventos (p.ej. QuestionsService.answer()), igual que MailModule/StorageModule.
// Expone el NotificationsController.
// ============================================================================

import { Global, Module } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
