import { Module } from '@nestjs/common';
import { UsersModule } from '#src/modules/users/users.module';
import { NotificationsModule } from '#src/modules/notifications/notifications.module';
import { NotificationSettingsController } from './controllers/notification-settings.controller.js';

import { NotificationInboxController } from './controllers/notification-inbox.controller.js';

@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [NotificationSettingsController, NotificationInboxController],
})
export class SharedNotificationsApiModule {}
