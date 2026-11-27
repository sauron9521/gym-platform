import { Module } from '@nestjs/common';
import { NotificationsModule } from '#src/modules/notifications/notifications.module';
import { AdminNotificationInboxController } from './controllers/admin-notification-inbox.controller.js';

@Module({ imports: [NotificationsModule], controllers: [AdminNotificationInboxController] })
export class AdminNotificationsApiModule {}
