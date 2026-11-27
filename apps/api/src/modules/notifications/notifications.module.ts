import { Module } from '@nestjs/common';
import { NotificationSettingsRepository } from './repositories/notification-settings.repository.js';
import { NotificationSettingsService } from './services/notification-settings.service.js';

import { NotificationInboxRepository } from './repositories/notification-inbox.repository.js';
import { NotificationInboxService } from './services/notification-inbox.service.js';

@Module({
  controllers: [],
  providers: [
    NotificationSettingsRepository,
    NotificationSettingsService,
    NotificationInboxRepository,
    NotificationInboxService,
  ],
  exports: [NotificationSettingsService, NotificationInboxService],
})
export class NotificationsModule {}
