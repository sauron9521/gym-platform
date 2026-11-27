import { Platform } from 'react-native';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import {
  readNativeDevicePermission,
  WORKOUT_REMINDER_CHANNEL,
} from './native-notification-permission';
import type { NativeReminderPort } from './native-reminder-reconciliation';

/** Native port used by the gated lifecycle. No module load on web/Expo Go. The
 * same narrow pinned SDK modules avoid the push auto-registration barrel. */
export async function openNativeReminderPort(): Promise<NativeReminderPort | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const platform = Platform.OS;
  try {
    if ((await import('expo')).isRunningInExpoGo()) return null;
    const [list, cancel, schedule, crypto, presented, dismiss] = await Promise.all([
      import('expo-notifications/build/getAllScheduledNotificationsAsync'),
      import('expo-notifications/build/cancelScheduledNotificationAsync'),
      import('expo-notifications/build/scheduleNotificationAsync'),
      import('expo-crypto'),
      import('expo-notifications/build/getPresentedNotificationsAsync'),
      import('expo-notifications/build/dismissNotificationAsync'),
    ]);
    return {
      platform,
      now: Date.now,
      digest: (value) => crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, value),
      list: list.getAllScheduledNotificationsAsync,
      cancel: cancel.cancelScheduledNotificationAsync,
      async listPresented() {
        const rows = await presented.getPresentedNotificationsAsync();
        return rows.map((row) => row.request.identifier);
      },
      dismiss: dismiss.dismissNotificationAsync,
      async canSchedule() {
        if ((await readNativeDevicePermission()).status !== 'granted') return false;
        if (platform === 'ios' || Number(Platform.Version) < 26) return true;
        const { getNotificationChannelAsync } =
          await import('expo-notifications/build/getNotificationChannelAsync');
        const channel = await getNotificationChannelAsync(WORKOUT_REMINDER_CHANNEL);
        return (
          !!channel &&
          channel.importance >= AndroidImportance.MIN &&
          channel.importance <= AndroidImportance.MAX &&
          channel.bypassDnd === false
        );
      },
      schedule: (item) =>
        schedule.scheduleNotificationAsync({
          identifier: item.identifier,
          content: { title: item.title, body: item.body, data: {}, sound: 'default' },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: item.dueAt,
            delivery: 'bestEffort',
            ...(platform === 'android' ? { channelId: WORKOUT_REMINDER_CHANNEL } : {}),
          },
        }),
    };
  } catch {
    return null;
  }
}
