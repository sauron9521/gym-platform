import type { paths } from '@gym/api-client';
import { z } from 'zod';
import { workoutReminderLeadMinutes } from '@gym/domain';

export type NotificationSettings =
  paths['/users/me/notification-settings']['get']['responses'][200]['content']['application/json'];

const preferenceSchema = z.union([
  z.strictObject({
    category: z.enum(['TRAINER', 'PROGRAM']),
    channel: z.literal('MOBILE_PUSH'),
    enabled: z.boolean(),
    consentedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  z.strictObject({
    category: z.literal('WORKOUT'),
    channel: z.literal('LOCAL_REMINDER'),
    enabled: z.boolean(),
    consentedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  z.strictObject({
    category: z.literal('ACCOUNT'),
    channel: z.literal('EMAIL'),
    enabled: z.boolean(),
    consentedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
]);
export const notificationSettingsSchema = z
  .strictObject({
    quietHoursEnabled: z.boolean(),
    quietStartMinute: z.int().min(0).max(1439),
    quietEndMinute: z.int().min(0).max(1439),
    reminderLeadMinutes: z.literal(workoutReminderLeadMinutes),
    timezone: z.string().max(64).nullable(),
    preferences: z.array(preferenceSchema).length(4),
  })
  .refine(
    (value) =>
      value.quietStartMinute !== value.quietEndMinute &&
      new Set(value.preferences.map((p) => p.category)).size === 4 &&
      value.preferences.every((p) => p.enabled === (p.consentedAt !== null)),
  );

export function parseNotificationSettings(data: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(data);
  if (!parsed.success) throw new Error('Invalid notification settings response');
  return parsed.data;
}
