import { Module } from '@nestjs/common';
import { NotificationWorkerMetricsModule } from '#src/common/http-metrics/notification-worker-metrics.module';
import { NotificationSettingsRepository } from './repositories/notification-settings.repository.js';
import { NotificationSettingsService } from './services/notification-settings.service.js';

import { NotificationInboxRepository } from './repositories/notification-inbox.repository.js';
import { NotificationInboxService } from './services/notification-inbox.service.js';

import { OutboxDispatchRepository } from './repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from './services/outbox-dispatch.service.js';

import { NotificationEmailSender } from './delivery/notification-email.sender.js';
import { NotificationEmailDispatchService } from './services/notification-email-dispatch.service.js';
import { NotificationRetentionRepository } from './repositories/notification-retention.repository.js';
import { NotificationRetentionService } from './services/notification-retention.service.js';
import { NotificationDeliveryRepository } from './repositories/notification-delivery.repository.js';

import { AdminNotificationInboxRepository } from './repositories/admin-notification-inbox.repository.js';
import { AdminNotificationInboxService } from './services/admin-notification-inbox.service.js';

@Module({
  imports: [NotificationWorkerMetricsModule],
  controllers: [],
  providers: [
    NotificationSettingsRepository,
    NotificationSettingsService,
    NotificationInboxRepository,
    NotificationInboxService,
    OutboxDispatchRepository,
    OutboxDispatchService,
    NotificationDeliveryRepository,
    NotificationRetentionRepository,
    NotificationRetentionService,
    NotificationEmailSender,
    NotificationEmailDispatchService,
    AdminNotificationInboxRepository,
    AdminNotificationInboxService,
  ],
  exports: [NotificationSettingsService, NotificationInboxService, AdminNotificationInboxService],
})
export class NotificationsModule {}
