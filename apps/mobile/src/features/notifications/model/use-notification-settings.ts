import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
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
import {
  readNativeDevicePermission,
  requestNativeDevicePermission,
} from '../lib/native-notification-permission';
import { parseInstant } from '@gym/datetime';
import { notificationSettingsSchema } from '../lib/settings-contract';

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

/** Device permission is independent of account consent and not a delivery eligibility grant. */
export function useDevicePermission(read?: ReadDevicePermission) {
  const scope = useInboxScope();
  const client = useQueryClient();
  const queryKey = [
    'account',
    'notification-device-permission',
    scope?.ownerId ?? 'signed-out',
  ] as const;
  const [requesting, setRequesting] = useState(false);
  const active = useRef(false);
  const foreground = useSyncExternalStore(subscribeFocus, isFocused, isFocused);
  const permission = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!scope) return { status: 'unavailable' as const, canRequest: false };
      assertInboxCurrent(scope, signal);
      const result = read
        ? { status: await readDevicePermission(read), canRequest: false }
        : await readNativeDevicePermission();
      assertInboxCurrent(scope, signal);
      return result;
    },
    enabled: !!scope && foreground && !requesting,
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: false,
  });
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      if (scope?.isCurrent())
        void client.invalidateQueries(
          { queryKey: ['account', 'notification-device-permission', scope.ownerId], exact: true },
          { cancelRefetch: false },
        );
      return () => {
        active.current = false;
      };
    }, [client, scope]),
  );
  const snapshot =
    scope?.isCurrent() &&
    foreground &&
    !requesting &&
    permission.isSuccess &&
    !permission.isFetching
      ? permission.data
      : { status: 'unavailable' as const, canRequest: false };
  async function request(channelName: string) {
    if (read || requesting || !snapshot.canRequest || !scope?.isCurrent()) return;
    const settingsKey = accountQueryKeys.notificationSettings(scope.ownerId);
    const entry = client.getQueryCache().find({ queryKey: settingsKey, exact: true });
    const data = entry?.state.data;
    const current = () => {
      if (
        !active.current ||
        !scope.isCurrent() ||
        !isOnline() ||
        !isFocused() ||
        !entry ||
        client.getQueryCache().find({ queryKey: settingsKey, exact: true }) !== entry ||
        entry.state.data !== data ||
        entry.state.status !== 'success' ||
        entry.state.isInvalidated ||
        entry.state.fetchStatus !== 'idle'
      )
        return false;
      const parsed = notificationSettingsSchema.safeParse(data);
      if (!parsed.success) return false;
      const consent = parsed.data.preferences.find(
        (p) => p.category === 'WORKOUT' && p.channel === 'LOCAL_REMINDER',
      );
      const at = parseInstant(consent?.consentedAt);
      return consent?.enabled === true && !!at && at.getTime() <= Date.now();
    };
    if (!current()) return;
    setRequesting(true);
    try {
      await requestNativeDevicePermission(current, channelName);
    } finally {
      // The system dialog may have backgrounded the app or the account changed.
      // Never use the result; a fresh scoped GET on resume is authoritative.
      if (scope.isCurrent() && active.current) await permission.refetch();
      setRequesting(false);
    }
  }
  return { ...snapshot, requesting, request };
}
