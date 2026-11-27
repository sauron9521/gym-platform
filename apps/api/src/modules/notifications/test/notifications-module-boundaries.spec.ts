import { MODULE_METADATA } from '@nestjs/common/constants';
import { NotificationsModule } from '../notifications.module.js';
import * as publicApi from '../public-api.js';
import { OutboxDispatchRepository } from '../repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from '../services/outbox-dispatch.service.js';
import { NotificationEmailSender } from '../delivery/notification-email.sender.js';
import { NotificationEmailDispatchService } from '../services/notification-email-dispatch.service.js';
import { NotificationRetentionRepository } from '../repositories/notification-retention.repository.js';
import { NotificationRetentionService } from '../services/notification-retention.service.js';
import { NotificationDeliveryRepository } from '../repositories/notification-delivery.repository.js';
import { AdminNotificationInboxRepository } from '../repositories/admin-notification-inbox.repository.js';
import { NotificationInboxRepository } from '../repositories/notification-inbox.repository.js';
import { NotificationSettingsRepository } from '../repositories/notification-settings.repository.js';
import {
  notificationSettingsPatchSchema,
  reminderLeadMinutes,
} from '../domain/notification-settings.policy.js';

describe('NotificationsModule public boundary', () => {
  it('exports account settings and Inbox services while keeping repositories private', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, NotificationsModule)).toEqual([
      NotificationSettingsRepository,
      publicApi.NotificationSettingsService,
      NotificationInboxRepository,
      publicApi.NotificationInboxService,
      OutboxDispatchRepository,
      OutboxDispatchService,
      NotificationDeliveryRepository,
      NotificationRetentionRepository,
      NotificationRetentionService,
      NotificationEmailSender,
      NotificationEmailDispatchService,
      AdminNotificationInboxRepository,
      publicApi.AdminNotificationInboxService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, NotificationsModule)).toEqual([
      publicApi.NotificationSettingsService,
      publicApi.NotificationInboxService,
      publicApi.AdminNotificationInboxService,
    ]);
  });

  it('exposes settings and the transaction-local publication contract', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'AdminNotificationInboxService',
      'NotificationInboxService',
      'NotificationSettingsService',
      'adminNotificationInboxQuerySchema',
      'inboxEventTypes',
      'notificationInboxQuerySchema',
      'notificationSettingsPatchSchema',
      'publishOutboxEvent',
      'publishProgramAssignmentTransition',
      'reminderLeadMinutes',
    ]);
    expect(publicApi.notificationSettingsPatchSchema).toBe(notificationSettingsPatchSchema);
    expect(publicApi.reminderLeadMinutes).toBe(reminderLeadMinutes);
    expect(Object.getOwnPropertyNames(publicApi.NotificationSettingsService.prototype)).toEqual([
      'constructor',
      'get',
      'patch',
    ]);
  });
});
