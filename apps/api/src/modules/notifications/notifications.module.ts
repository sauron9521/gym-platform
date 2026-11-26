import { Module } from '@nestjs/common';
import { NotificationSettingsRepository } from './repositories/notification-settings.repository.js';
import { NotificationSettingsService } from './services/notification-settings.service.js';

@Module({
  controllers: [],
  providers: [NotificationSettingsRepository, NotificationSettingsService],
  exports: [NotificationSettingsService],
})
export class NotificationsModule {}
