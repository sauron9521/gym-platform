import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { useLocaleSelection } from '@/shared/i18n/locale-provider';
import { accountQueryKeys } from '@/shared/api/query-client';
import { useInboxScope } from './inbox-query';
import { ReminderLifecycle } from './reminder-lifecycle';
import { prepareLocalReminders } from './prepare-local-reminders';
import { openNativeReminderPort } from '../lib/native-reminder-port';
import {
  cancelManagedNativeReminders,
  reconcileNativeReminders,
} from '../lib/native-reminder-reconciliation';
import { readNativeDevicePermission } from '../lib/native-notification-permission';
import { REMINDER_QA_ENABLED } from '../lib/reminder-qa-mode';
import { installReminderForegroundHandler } from '../lib/native-reminder-foreground';

// Release gate: change only in a reviewed native QA/activation slice.
// Disabled still attempts managed cleanup at auth boundaries.
export const LOCAL_REMINDER_SCHEDULING_ENABLED = false;

export function useReminderLifecycle() {
  const client = useQueryClient();
  const [reminders] = useState(
    () =>
      new ReminderLifecycle({
        enabled: LOCAL_REMINDER_SCHEDULING_ENABLED || REMINDER_QA_ENABLED,
        foreground: () => AppState.currentState === 'active' && focusManager.isFocused(),
        online: () => onlineManager.isOnline(),
        openPort: openNativeReminderPort,
        prepare: (scope, signal) =>
          prepareLocalReminders({
            client,
            scope,
            signal,
            readPermission: async () => (await readNativeDevicePermission()).status,
          }),
        reconcile: reconcileNativeReminders,
        cancel: cancelManagedNativeReminders,
      }),
  );
  return reminders;
}

export function ReminderRuntime({ reminders }: { reminders: ReminderLifecycle }) {
  const scope = useInboxScope();
  const { locale } = useLocaleSelection();
  const client = useQueryClient();
  useEffect(() => {
    void reminders.end();
  }, [reminders]);
  useEffect(() => {
    if (!REMINDER_QA_ENABLED) return;
    let mounted = true;
    void installReminderForegroundHandler(
      (notification) => reminders.admitForeground(notification),
      () => mounted,
    ).then((ready) => {
      if (mounted) reminders.setForegroundHandlerReady(ready);
    });
    return () => {
      mounted = false;
      reminders.setForegroundHandlerReady(false);
    };
  }, [reminders]);

  useEffect(() => {
    reminders.update(scope ? { scope, locale } : null);
    return () => reminders.update(null);
  }, [reminders, scope, locale]);

  useEffect(() => {
    if (!(LOCAL_REMINDER_SCHEDULING_ENABLED || REMINDER_QA_ENABLED) || !scope) return;
    const prefixes = [
      accountQueryKeys.me(scope.ownerId),
      accountQueryKeys.workouts(scope.ownerId),
      accountQueryKeys.notificationSettings(scope.ownerId),
    ];
    const refresh = () => reminders.refresh();
    const unsubscribe = [
      client.getQueryCache().subscribe((event) => {
        const permissionKey = accountQueryKeys.notificationDevicePermission(scope.ownerId);
        if (
          event.query.queryKey.length === permissionKey.length &&
          permissionKey.every((part, i) => event.query.queryKey[i] === part)
        ) {
          // Re-read after explicit OS prompt even when Android never emits
          // a background/foreground transition. Closing Settings is not revocation.
          if (event.type === 'updated' && event.action.type === 'success') refresh();
          return;
        }

        if (!prefixes.some((prefix) => prefix.every((part, i) => event.query.queryKey[i] === part)))
          return;
        if (
          event.type === 'removed' ||
          (event.type === 'updated' &&
            (event.action.type === 'invalidate' || event.action.type === 'success'))
        )
          refresh();
      }),
      client.getMutationCache().subscribe((event) => {
        if (
          event.type === 'added' ||
          (event.type === 'updated' && ['pending', 'success', 'error'].includes(event.action.type))
        )
          refresh();
      }),
      onlineManager.subscribe(refresh),
      focusManager.subscribe(refresh),
    ];
    return () => {
      for (const off of unsubscribe) off();
    };
  }, [client, reminders, scope]);
  return null;
}
