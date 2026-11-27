'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';
import {
  notificationSettingsOptions,
  readNotificationSettings,
  SettingsError,
  updateNotificationSettings,
  type SettingsPatch,
} from '../api/settings';

const online = () => onlineManager.isOnline();
const subscribeOnline = (cb: () => void) => onlineManager.subscribe(cb);
const visible = () => document.visibilityState === 'visible';
const subscribeVisible = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};
type Write = { body: SettingsPatch; isCurrent: () => boolean };

export function useNotificationSettings(owner: string) {
  const client = useQueryClient();
  const authFailure = useAuthFailure();
  const connected = useSyncExternalStore(subscribeOnline, online, () => true);
  const shown = useSyncExternalStore(subscribeVisible, visible, () => false);
  const blockedRef = useRef(false);
  const options = notificationSettingsOptions(owner);
  const filter = { queryKey: options.queryKey, exact: true } as const;
  const lock = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const terminal = useCallback(
    (error: unknown) => {
      if (
        blockedRef.current ||
        !(error instanceof SettingsError) ||
        ![401, 403, 409].includes(error.status ?? 0)
      )
        return false;
      blockedRef.current = true;
      setBlocked(true);
      if (error.status === 401) authFailure(error);
      return true;
    },
    [authFailure],
  );
  const mutation = useMutation({
    mutationFn: async ({ body, isCurrent }: Write) => {
      await client.cancelQueries(filter);
      return updateNotificationSettings(owner, body, isCurrent);
    },
    onSuccess: async (data, { isCurrent }) => {
      if (!isCurrent()) return;
      await client.cancelQueries(filter);
      if (isCurrent()) client.setQueryData(options.queryKey, data);
    },
    onError: async (error, { isCurrent }) => {
      if (!isCurrent()) return;
      if (terminal(error)) return;
      // A lost response may have committed. Read-only reconciliation; never replay PATCH.
      await client.invalidateQueries({ ...filter, refetchType: 'none' });
      if (online() && visible() && isCurrent())
        await client
          .fetchQuery({ ...options, staleTime: 0, networkMode: 'always' })
          .catch(() => undefined);
    },
    retry: false,
    networkMode: 'always',
  });
  const query = useQuery({
    ...options,
    queryFn: ({ signal }) => {
      if (blockedRef.current) throw new SettingsError(409);
      return readNotificationSettings(owner, signal);
    },
    enabled: shown && !blocked && !mutation.isPending,
  });
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'error' &&
          event.query.queryKey[0] === 'notification-settings' &&
          event.query.queryKey[1] === owner
        )
          terminal(event.action.error);
      }),
    [client, owner, terminal],
  );
  const denied =
    blocked ||
    [mutation.error, query.error].some(
      (error) => error instanceof SettingsError && [401, 403, 409].includes(error.status ?? 0),
    );
  const data =
    shown && !denied && !query.isError && (!query.isFetching || mutation.isPending)
      ? query.data
      : undefined;
  const disabled = !connected || !shown || !data || query.isFetching || mutation.isPending;
  async function change(body: SettingsPatch) {
    if (blockedRef.current || disabled || lock.current || !online() || !visible()) return;
    const entry = client.getQueryCache().find(filter);
    if (!entry) return;
    const isCurrent = () => !blockedRef.current && client.getQueryCache().find(filter) === entry;
    lock.current = true;
    try {
      await mutation.mutateAsync({ body, isCurrent });
    } catch {
      /* Render localized error. */
    } finally {
      lock.current = false;
    }
  }
  async function reload() {
    mutation.reset();
    await query.refetch();
  }
  return { data, disabled, connected, shown, query, mutation, denied, change, reload };
}
