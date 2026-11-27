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

export { NotificationInboxService } from './services/notification-inbox.service.js';
export {
  notificationInboxQuerySchema,
  type NotificationInboxQuery,
} from './domain/notification-inbox.policy.js';

export { inboxEventTypes } from './domain/outbox-event.policy.js';

export { publishProgramAssignmentTransition } from './services/publish-program-assignment-transition.js';
