import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './controllers/notification-settings.controller.js';
import { NotificationSettingsRepository } from './repositories/notification-settings.repository.js';
import { NotificationSettingsService } from './services/notification-settings.service.js';

@Module({
  controllers: [NotificationSettingsController],
  providers: [NotificationSettingsRepository, NotificationSettingsService],
})
export class NotificationsModule {}
