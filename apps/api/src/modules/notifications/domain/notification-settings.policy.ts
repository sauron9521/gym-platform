import { z } from 'zod';

export const reminderLeadMinutes = [15, 60, 1440] as const;
const minute = z.number().int().min(0).max(1439);
const lead = z.literal(reminderLeadMinutes);

/** Minutes since local midnight. Equal endpoints are ambiguous and rejected. */
export const notificationSettingsSchema = z
  .strictObject({
    quietHoursEnabled: z.boolean(),
    quietStartMinute: minute,
    quietEndMinute: minute,
    reminderLeadMinutes: lead,
  })
  .refine((value) => value.quietStartMinute !== value.quietEndMinute, {
    path: ['quietEndMinute'],
    message: 'Quiet hours must have distinct endpoints',
  });

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export const defaultNotificationSettings: Readonly<NotificationSettings> = Object.freeze({
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
});

// Explicit MVP pair allowlist derived from ADR-008 event taxonomy. No
// marketing, Admin, Inbox controls or urgent security mail consent.
export const notificationPreferenceSchema = z.union([
  z.strictObject({
    category: z.enum(['TRAINER', 'PROGRAM']),
    channel: z.literal('MOBILE_PUSH'),
    enabled: z.boolean(),
  }),
  z.strictObject({
    category: z.literal('WORKOUT'),
    channel: z.literal('LOCAL_REMINDER'),
    enabled: z.boolean(),
  }),
  z.strictObject({
    category: z.literal('ACCOUNT'),
    channel: z.literal('EMAIL'),
    enabled: z.boolean(),
  }),
]);
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export const defaultNotificationPreferences: readonly Readonly<NotificationPreference>[] =
  Object.freeze([
    Object.freeze({ category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false }),
    Object.freeze({ category: 'PROGRAM', channel: 'MOBILE_PUSH', enabled: false }),
    Object.freeze({ category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: false }),
    Object.freeze({ category: 'ACCOUNT', channel: 'EMAIL', enabled: false }),
  ] as const);

const preferencePatch = z
  .array(notificationPreferenceSchema)
  .min(1)
  .max(4)
  .refine(
    (values) =>
      new Set(values.map(({ category, channel }) => category + ':' + channel)).size ===
      values.length,
    'Duplicate category/channel',
  );

export const notificationSettingsPatchSchema = z
  .strictObject({
    quietHoursEnabled: z.boolean().optional(),
    quietStartMinute: minute.optional(),
    quietEndMinute: minute.optional(),
    reminderLeadMinutes: lead.optional(),
    preferences: preferencePatch.optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'At least one setting is required',
  );
export type NotificationSettingsPatch = z.infer<typeof notificationSettingsPatchSchema>;

/** Call under the settings write lock, not against a stale GET. */
export function mergeNotificationSettings(
  current: NotificationSettings,
  patch: NotificationSettingsPatch,
) {
  const { preferences: _preferences, ...fields } = notificationSettingsPatchSchema.parse(patch);
  return notificationSettingsSchema.parse({ ...current, ...fields });
}

/** Absence of explicit consent is OFF; malformed persisted state fails closed.
 * This does not authorize any transport, resolve recipients or grant OS permission. */
export function notificationConsentEnabled(value: unknown): boolean {
  const parsed = notificationPreferenceSchema.safeParse(value);
  return parsed.success && parsed.data.enabled;
}

export function isNotificationTimezone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    (value !== 'UTC' && !/^[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?$/.test(value))
  )
    return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type QuietHoursDecision = 'allowed' | 'quiet' | 'invalid';

/** Classify a real UTC instant, never construct an ambiguous local timestamp.
 * Both occurrences of a repeated DST minute have the same quiet policy. */
export function quietHoursAt(
  instant: Date,
  timezone: unknown,
  settings: NotificationSettings,
): QuietHoursDecision {
  const parsed = notificationSettingsSchema.safeParse(settings);
  if (!parsed.success || !Number.isFinite(instant.getTime()) || !isNotificationTimezone(timezone))
    return 'invalid';
  const { quietHoursEnabled, quietStartMinute, quietEndMinute } = parsed.data;
  if (!quietHoursEnabled) return 'allowed';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const localMinute =
    Number(parts.find((part) => part.type === 'hour')?.value) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isFinite(localMinute)) return 'invalid';
  const quiet =
    quietStartMinute < quietEndMinute
      ? localMinute >= quietStartMinute && localMinute < quietEndMinute
      : localMinute >= quietStartMinute || localMinute < quietEndMinute;
  return quiet ? 'quiet' : 'allowed';
}

/** Eligibility of a future local reminder instant only, not native scheduling.
 * Skip expired/quiet reminders rather than shifting them past the useful time. */
export function localReminderCandidate(input: {
  status: string;
  scheduledAt: Date;
  now: Date;
  timezone: unknown;
  settings: NotificationSettings;
  consent: unknown;
}): Date | null {
  const { status, scheduledAt, now, timezone, settings, consent } = input;
  const parsed = notificationPreferenceSchema.safeParse(consent);
  if (
    status !== 'PLANNED' ||
    !parsed.success ||
    parsed.data.category !== 'WORKOUT' ||
    parsed.data.channel !== 'LOCAL_REMINDER' ||
    !parsed.data.enabled ||
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(scheduledAt.getTime()) ||
    !notificationSettingsSchema.safeParse(settings).success
  )
    return null;
  const due = new Date(scheduledAt.getTime() - settings.reminderLeadMinutes * 60_000);
  return due.getTime() > now.getTime() && quietHoursAt(due, timezone, settings) === 'allowed'
    ? due
    : null;
}
