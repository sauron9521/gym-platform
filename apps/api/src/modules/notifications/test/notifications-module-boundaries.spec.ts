import { MODULE_METADATA } from '@nestjs/common/constants';
import { NotificationsModule } from '../notifications.module.js';
import * as publicApi from '../public-api.js';
import { NotificationSettingsRepository } from '../repositories/notification-settings.repository.js';
import {
  notificationSettingsPatchSchema,
  reminderLeadMinutes,
} from '../domain/notification-settings.policy.js';

describe('NotificationsModule public boundary', () => {
  it('exports only its existing account settings service and keeps its repository private', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, NotificationsModule)).toEqual([
      NotificationSettingsRepository,
      publicApi.NotificationSettingsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, NotificationsModule)).toEqual([
      publicApi.NotificationSettingsService,
    ]);
  });

  it('exposes exactly the existing service, patch schema and reminder vocabulary', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'NotificationSettingsService',
      'notificationSettingsPatchSchema',
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
