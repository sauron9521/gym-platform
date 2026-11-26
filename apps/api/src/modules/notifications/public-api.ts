// Account-owned notification settings contract for the HTTP adapter.
export { NotificationSettingsService } from './services/notification-settings.service.js';
export {
  notificationSettingsPatchSchema,
  reminderLeadMinutes,
  type NotificationSettingsPatch,
} from './domain/notification-settings.policy.js';

// Transaction-local publication contract for domain producers.
export { publishOutboxEvent } from './services/publish-outbox-event.js';
export type { OutboxEventInput } from './domain/outbox-event.policy.js';
