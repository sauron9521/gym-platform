import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  onlineManager,
  focusManager,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { accountQueryKeys } from '@/shared/api/query-client';
import {
  MobileAccessDeniedError,
  MobileSessionExpiredError,
  MobileReadHttpError,
} from '@/shared/api/api-error-policy';
import { useInboxScope } from './inbox-query';
import {
  notificationSettingsOptions,
  writeNotificationSettings,
  type SettingsPatch,
} from '../services/settings-api';
import { assertInboxCurrent, type InboxScope } from '../services/inbox-api';
import { readDevicePermission, type ReadDevicePermission } from '../lib/notification-policy';

const subscribeOnline = (callback: () => void) => onlineManager.subscribe(callback);
const isOnline = () => onlineManager.isOnline();
const subscribeFocus = (callback: () => void) => focusManager.subscribe(callback);
const isFocused = () => focusManager.isFocused();

function denied(error: unknown) {
  return (
    error instanceof MobileAccessDeniedError ||
    error instanceof MobileSessionExpiredError ||
    (error instanceof MobileReadHttpError && error.status === 409)
  );
}
type Write = { body: SettingsPatch; scope: InboxScope; isCurrent: () => boolean };

export function useNotificationSettings() {
  const scope = useInboxScope();
  const client = useQueryClient();
  const connected = useSyncExternalStore(subscribeOnline, isOnline, isOnline);
  const foreground = useSyncExternalStore(subscribeFocus, isFocused, isFocused);
  const key = accountQueryKeys.notificationSettings(scope?.ownerId ?? 'signed-out');
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: async ({ body, scope: writeScope, isCurrent }: Write) => {
      await client.cancelQueries({
        queryKey: accountQueryKeys.notificationSettings(writeScope.ownerId),
        exact: true,
      });
      if (!isCurrent()) throw new Error('Notification settings session changed');
      return writeNotificationSettings(writeScope, body);
    },
    onSuccess: async (data, write) => {
      if (!write.isCurrent()) return;
      const queryKey = accountQueryKeys.notificationSettings(write.scope.ownerId);
      await client.cancelQueries({ queryKey, exact: true });
      if (write.isCurrent()) client.setQueryData(queryKey, data);
    },
    onError: async (error, write) => {
      if (!write.isCurrent()) return;
      const queryKey = accountQueryKeys.notificationSettings(write.scope.ownerId);
      await client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
      if (denied(error)) return;
      // Ambiguous writes may already have committed. Never replay PATCH.
      if (write.isCurrent() && isOnline() && isFocused()) {
        await client
          .fetchQuery({ ...notificationSettingsOptions(write.scope), networkMode: 'always' })
          .catch(() => undefined);
      }
    },
    retry: false,
    networkMode: 'always',
  });
  const blocked = denied(mutation.error);
  const query = useQuery({
    ...(scope
      ? notificationSettingsOptions(scope)
      : {
          queryKey: key,
          queryFn: () => Promise.reject(new Error('No verified account')),
          retry: false,
        }),
    enabled: !!scope && foreground && connected && !mutation.isPending && !blocked,
  });
  useFocusEffect(
    useCallback(() => {
      if (scope?.isCurrent() && isOnline())
        void client.invalidateQueries(
          { queryKey: accountQueryKeys.notificationSettings(scope.ownerId), exact: true },
          { cancelRefetch: false },
        );
    }, [client, scope]),
  );
  const data =
    scope?.isCurrent() &&
    foreground &&
    !blocked &&
    query.isSuccess &&
    !(mutation.isError && client.getQueryState(key)?.isInvalidated) &&
    (!query.isFetching || mutation.isPending)
      ? query.data
      : undefined;
  const disabled = !data || !connected || !foreground || query.isFetching || mutation.isPending;

  async function change(body: SettingsPatch) {
    if (!scope?.isCurrent() || disabled || lock.current || !isOnline() || !isFocused()) return;
    const entry = client.getQueryCache().find({ queryKey: key, exact: true });
    if (!entry) return;
    const isCurrent = () =>
      scope.isCurrent() && client.getQueryCache().find({ queryKey: key, exact: true }) === entry;
    lock.current = true;
    try {
      await mutation.mutateAsync({ body, scope, isCurrent });
    } catch {
      /* Localized feedback in UI. */
    } finally {
      lock.current = false;
    }
  }

  async function reload() {
    if (!scope?.isCurrent() || !isOnline() || !isFocused() || mutation.isPending) return;
    mutation.reset();
    await query.refetch();
  }
  return {
    data,
    disabled,
    connected,
    foreground,
    query,
    mutation,
    denied: blocked || denied(query.error),
    change,
    reload,
  };
}

/** Device status is read-only and deliberately not a delivery eligibility grant. */
export function useDevicePermission(read?: ReadDevicePermission) {
  const scope = useInboxScope();
  const client = useQueryClient();
  const queryKey = [
    'account',
    'notification-device-permission',
    scope?.ownerId ?? 'signed-out',
  ] as const;
  const permission = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!scope) return 'unavailable' as const;
      assertInboxCurrent(scope, signal);
      const status = await readDevicePermission(read);
      assertInboxCurrent(scope, signal);
      return status;
    },
    enabled: !!scope,
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: false,
  });
  useFocusEffect(
    useCallback(() => {
      if (scope?.isCurrent())
        void client.invalidateQueries(
          { queryKey: ['account', 'notification-device-permission', scope.ownerId], exact: true },
          { cancelRefetch: false },
        );
    }, [client, scope]),
  );
  return scope?.isCurrent() && permission.isSuccess && !permission.isFetching
    ? permission.data
    : 'unavailable';
}
