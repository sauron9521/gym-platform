import { Module } from '@nestjs/common';
import { NotificationsModule } from '#src/modules/notifications/notifications.module';
import { NotificationSettingsController } from './controllers/notification-settings.controller.js';

@Module({ imports: [NotificationsModule], controllers: [NotificationSettingsController] })
export class SharedNotificationsApiModule {}
