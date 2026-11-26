// Account-owned notification settings contract for the HTTP adapter.
export { NotificationSettingsService } from './services/notification-settings.service.js';
export {
  notificationSettingsPatchSchema,
  reminderLeadMinutes,
  type NotificationSettingsPatch,
} from './domain/notification-settings.policy.js';
