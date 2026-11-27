import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openNativeReminderPort } from '@/features/notifications/lib/native-reminder-port';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android', Version: 34 },
  expoGo: vi.fn(() => false),
  read: vi.fn(),
  channel: vi.fn(),
  list: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  digest: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo', () => ({ isRunningInExpoGo: mocks.expoGo }));
vi.mock('@/features/notifications/lib/native-notification-permission', () => ({
  WORKOUT_REMINDER_CHANNEL: 'workout-reminders',
  readNativeDevicePermission: mocks.read,
}));
vi.mock('expo-notifications/build/getNotificationChannelAsync', () => ({
  getNotificationChannelAsync: mocks.channel,
}));
vi.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: mocks.list,
}));
vi.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: mocks.cancel,
}));
vi.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: mocks.schedule,
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

beforeEach(() => {
  mocks.platform.OS = 'android';
  mocks.expoGo.mockReturnValue(false);
  mocks.read.mockResolvedValue({ status: 'granted' });
  mocks.channel.mockResolvedValue({ importance: 3, bypassDnd: false });
  mocks.list.mockResolvedValue([]);
  mocks.schedule.mockResolvedValue('managed');
});
describe('native reminder port boundary', () => {
  it('fails closed on web and Expo Go', async () => {
    mocks.platform.OS = 'web';
    expect(await openNativeReminderPort()).toBeNull();
    mocks.platform.OS = 'android';
    mocks.expoGo.mockReturnValue(true);
    expect(await openNativeReminderPort()).toBeNull();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it('requires current OS permission and usable Android channel', async () => {
    const port = (await openNativeReminderPort())!;
    expect(await port.canSchedule()).toBe(true);
    for (const channel of [
      null,
      { importance: 0, bypassDnd: false },
      { importance: 3, bypassDnd: true },
      { importance: 3 },
    ]) {
      mocks.channel.mockResolvedValue(channel);
      expect(await port.canSchedule()).toBe(false);
    }
    mocks.read.mockResolvedValue({ status: 'denied' });
    expect(await port.canSchedule()).toBe(false);
  });
  it.each(['ios', 'android'])(
    'uses explicit one-shot date, generic data and best effort on %s',
    async (platform) => {
      mocks.platform.OS = platform;
      const port = (await openNativeReminderPort())!;
      await port.list();
      await port.digest('input');
      await port.cancel('managed');
      await port.schedule({
        identifier: 'managed',
        dueAt: 1700000000000,
        title: 'OVRANTO',
        body: 'Generic reminder',
      });
      expect(mocks.list).toHaveBeenCalledTimes(1);
      expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'input');
      expect(mocks.cancel).toHaveBeenCalledWith('managed');
      expect(mocks.schedule).toHaveBeenCalledWith({
        identifier: 'managed',
        content: { title: 'OVRANTO', body: 'Generic reminder', data: {}, sound: 'default' },
        trigger: {
          type: 'date',
          date: 1700000000000,
          delivery: 'bestEffort',
          ...(platform === 'android' ? { channelId: 'workout-reminders' } : {}),
        },
      });
    },
  );
});
