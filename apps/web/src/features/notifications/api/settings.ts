import type { paths } from '@gym/api-client';
import { onlineManager, queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { webApi } from '@/shared/api/client';

const path = '/users/me/notification-settings' as const;
type Resource = paths[typeof path];
export type NotificationSettings = Resource['get']['responses'][200]['content']['application/json'];
export type SettingsPatch = Resource['patch']['requestBody']['content']['application/json'];
export class SettingsError extends Error {
  constructor(readonly status?: number) {
    super('Notification settings request failed');
  }
}

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
const settingsSchema = z
  .strictObject({
    quietHoursEnabled: z.boolean(),
    quietStartMinute: z.int().min(0).max(1439),
    quietEndMinute: z.int().min(0).max(1439),
    reminderLeadMinutes: z.literal([15, 60, 1440]),
    timezone: z.string().max(64).nullable(),
    preferences: z.array(preferenceSchema).length(4),
  })
  .refine(
    (value) =>
      value.quietStartMinute !== value.quietEndMinute &&
      new Set(value.preferences.map((p) => p.category)).size === 4 &&
      value.preferences.every((p) => p.enabled === (p.consentedAt !== null)),
  );

function parse(data: unknown): NotificationSettings {
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) throw new SettingsError();
  return parsed.data;
}
const headers = (owner: string) => ({ 'x-notification-owner': owner });
export const notificationSettingsKey = (owner: string) => ['notification-settings', owner] as const;
export async function readNotificationSettings(owner: string, signal: AbortSignal) {
  const { response, data } = await webApi.GET(path, {
    headers: headers(owner),
    signal,
    cache: 'no-store',
  });
  if (response.status !== 200) throw new SettingsError(response.status);
  return parse(data);
}
export function notificationSettingsOptions(owner: string) {
  return queryOptions({
    queryKey: notificationSettingsKey(owner),
    queryFn: ({ signal }) => readNotificationSettings(owner, signal),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

export async function updateNotificationSettings(
  owner: string,
  body: SettingsPatch,
  isCurrent: () => boolean,
) {
  if (!isCurrent() || !onlineManager.isOnline() || document.visibilityState !== 'visible')
    throw new SettingsError();
  const { response, data } = await webApi.PATCH(path, {
    body,
    headers: headers(owner),
    cache: 'no-store',
  });
  if (!isCurrent()) throw new SettingsError();
  if (response.status !== 200) throw new SettingsError(response.status);
  return parse(data);
}
