// Optional transport only. Urgent security mail remains owned by Auth.
export const OPTIONAL_EMAIL_TYPE = 'trainer.application.reviewed';
export const EMAIL_DESTINATION = 'account-email';
export const DELIVERY_MAX_ATTEMPTS = 5;
export const DELIVERY_LEASE_MS = 30_000;
export const DELIVERY_TTL_MS = 24 * 60 * 60_000;
export const QUIET_RECHECK_MS = 15 * 60_000;

export type DeliveryOutcome = 'accepted' | 'not_sent_retryable' | 'not_sent_permanent' | 'unknown';

export const EMAIL_BATCH_LIMIT = 5;
// One bounded, abortable SMTP attempt per admitted delivery, leaving lease
// time for database commit and completion. Unknown outcomes never retry.
export const EMAIL_SEND_BUDGET_MS = 20_000;
export type EmailDestination = { email: string; locale: 'en' | 'uk' };
