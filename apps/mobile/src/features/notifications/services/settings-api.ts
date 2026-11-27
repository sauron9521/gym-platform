import type { paths } from '@gym/api-client';
import { onlineManager, queryOptions } from '@tanstack/react-query';
import { parseNotificationSettings } from '../lib/settings-contract';
export type { NotificationSettings } from '../lib/settings-contract';
import { accountQueryKeys } from '@/shared/api/query-client';
import { MobileSessionExpiredError, mobileReadError } from '@/shared/api/api-error-policy';
import { assertInboxCurrent, type InboxScope } from './inbox-api';

const path = '/users/me/notification-settings' as const;
type Resource = paths[typeof path];
export type SettingsPatch = Resource['patch']['requestBody']['content']['application/json'];

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
  return parseNotificationSettings(data);
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
