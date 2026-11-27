import { MODULE_METADATA } from '@nestjs/common/constants';
import { NotificationsModule } from '../notifications.module.js';
import * as publicApi from '../public-api.js';
import { OutboxDispatchRepository } from '../repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from '../services/outbox-dispatch.service.js';
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
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, NotificationsModule)).toEqual([
      publicApi.NotificationSettingsService,
      publicApi.NotificationInboxService,
    ]);
  });

  it('exposes settings and the transaction-local publication contract', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'NotificationInboxService',
      'NotificationSettingsService',
      'notificationInboxQuerySchema',
      'notificationSettingsPatchSchema',
      'publishOutboxEvent',
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
