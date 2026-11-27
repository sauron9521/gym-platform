import type { paths } from '@gym/api-client';
import { onlineManager, queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { accountQueryKeys } from '@/shared/api/query-client';
import { MobileSessionExpiredError, mobileReadError } from '@/shared/api/api-error-policy';
import { assertInboxCurrent, type InboxScope } from './inbox-api';

const path = '/users/me/notification-settings' as const;
type Resource = paths[typeof path];
export type NotificationSettings = Resource['get']['responses'][200]['content']['application/json'];
export type SettingsPatch = Resource['patch']['requestBody']['content']['application/json'];

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
  if (!parsed.success) throw new Error('Invalid notification settings response');
  return parsed.data;
}
function apiFor(scope: InboxScope, signal?: AbortSignal) {
  assertInboxCurrent(scope, signal);
  if (!onlineManager.isOnline()) throw new Error('Notification settings unavailable offline');
  const api = scope.getScopedApi(() => scope.isCurrent() && !signal?.aborted);
  if (!api) throw new Error('Notification settings session unavailable');
  return api;
}
async function confirmed(scope: InboxScope, status: number, data: unknown, signal?: AbortSignal) {
  assertInboxCurrent(scope, signal);
  if (status === 401) {
    await scope.signOut();
    throw new MobileSessionExpiredError();
  }
  if (status !== 200) throw mobileReadError(status, 'Notification settings request failed');
  return parse(data);
}
const headers = (scope: InboxScope) => ({ 'x-notification-owner': scope.ownerId });

export function notificationSettingsOptions(scope: InboxScope) {
  return queryOptions({
    queryKey: accountQueryKeys.notificationSettings(scope.ownerId),
    queryFn: async ({ signal }) => {
      const result = await apiFor(scope, signal).GET(path, { headers: headers(scope), signal });
      return confirmed(scope, result.response.status, result.data, signal);
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}
export async function writeNotificationSettings(scope: InboxScope, body: SettingsPatch) {
  const result = await apiFor(scope).PATCH(path, { headers: headers(scope), body });
  return confirmed(scope, result.response.status, result.data);
}
