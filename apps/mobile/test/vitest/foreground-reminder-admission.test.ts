import { describe, expect, it, vi } from 'vitest';
import { ForegroundReminderAdmission } from '@/features/notifications/lib/foreground-reminder-admission';
import {
  REMINDER_PREFIX,
  type VerifiedReminder,
} from '@/features/notifications/lib/native-reminder-reconciliation';
import {
  foregroundReminderBehavior,
  installReminderForegroundHandler,
  SUPPRESS_FOREGROUND,
} from '@/features/notifications/lib/native-reminder-foreground';

const mocks = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: mocks.set,
}));
const entry: VerifiedReminder = {
  identifier: REMINDER_PREFIX + 'v1.' + 'a'.repeat(64),
  dueAt: Date.parse('2026-11-27T12:00:30Z'),
  title: 'OVRANTO',
  body: 'You have an upcoming workout.',
  platform: 'android',
};
const notification = (item = entry) => ({
  request: {
    identifier: item.identifier,
    content: { title: item.title, body: item.body, data: {} },
    trigger:
      item.platform === 'android'
        ? {
            type: 'date',
            value: item.dueAt,
            channelId: 'workout-reminders',
            delivery: 'bestEffort',
            repeats: false,
          }
        : { type: 'timeInterval', seconds: 60, repeats: false },
  },
});
const shown = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};

describe('foreground reminder admission', () => {
  it.each(['android', 'ios'] as const)(
    'consumes a verified %s reminder only once, never sets badge',
    (platform) => {
      const item = { ...entry, platform };
      const gate = new ForegroundReminderAdmission();
      gate.replace([item], 1);
      const decide = (value: unknown) => gate.consume(value, item.dueAt);
      expect(foregroundReminderBehavior(notification(item), decide)).toEqual(shown);
      expect(foregroundReminderBehavior(notification(item), decide)).toEqual(SUPPRESS_FOREGROUND);
    },
  );
  it('rejects early, late across minute, malformed and unverified identifiers', () => {
    const gate = new ForegroundReminderAdmission();
    gate.replace([entry], 1);
    for (const time of [entry.dueAt - 1, entry.dueAt + 30000, NaN])
      expect(gate.consume(notification(), time)).toBe(false);
    for (const value of [
      null,
      {},
      notification({ ...entry, identifier: REMINDER_PREFIX + 'v1.' + 'b'.repeat(64) }),
    ])
      expect(gate.consume(value, entry.dueAt)).toBe(false);
    expect(gate.consume(notification(), entry.dueAt + 29999)).toBe(true);
  });
  it('rejects tampered content, private data, unexpected trigger, badge, subtitle or attachment', () => {
    const gate = new ForegroundReminderAdmission();
    gate.replace([entry], 1);
    for (const change of [
      { data: { id: 'private' } },
      { data: [] },
      { title: 'Other' },
      { subtitle: 'private' },
      { badge: 1 },
      { attachments: [{}] },
    ]) {
      const n = notification();
      Object.assign(n.request.content, change);
      expect(gate.consume(n, entry.dueAt)).toBe(false);
    }
    const n = notification();
    Object.assign(n.request.trigger, { type: 'push' });
    expect(gate.consume(n, entry.dueAt)).toBe(false);
    expect(gate.consume(notification(), entry.dueAt)).toBe(true);
  });
  it('replaces rather than accumulates, fails closed on inconsistent inventory', () => {
    const gate = new ForegroundReminderAdmission();
    for (const [entries, pending] of [
      [[entry], 2],
      [[entry, entry], 2],
      [[{ ...entry, identifier: 'foreign' }], 1],
    ] as const) {
      gate.replace(entries, pending);
      expect(gate.consume(notification(), entry.dueAt)).toBe(false);
    }
    gate.replace([entry], 1);
    gate.clear();
    expect(gate.consume(notification(), entry.dueAt)).toBe(false);
  });
  it('suppresses errors and stale installed handlers without restoring default show behavior', async () => {
    expect(
      foregroundReminderBehavior({}, () => {
        throw new Error('failure');
      }),
    ).toEqual(SUPPRESS_FOREGROUND);
    let mounted = true;
    expect(
      await installReminderForegroundHandler(
        () => true,
        () => mounted,
      ),
    ).toBe(true);
    const handler = mocks.set.mock.lastCall![0];
    expect(await handler.handleNotification({})).toEqual(shown);
    mounted = false;
    expect(await handler.handleNotification({})).toEqual(SUPPRESS_FOREGROUND);
    expect(
      await installReminderForegroundHandler(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(await mocks.set.mock.lastCall![0].handleNotification({})).toEqual(SUPPRESS_FOREGROUND);
    expect(mocks.set.mock.calls.every(([value]) => value !== null)).toBe(true);
  });
  it('only the most recent installation can admit', async () => {
    const first = installReminderForegroundHandler(
      () => true,
      () => true,
    );
    const second = installReminderForegroundHandler(
      () => false,
      () => true,
    );
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(await mocks.set.mock.lastCall![0].handleNotification({})).toEqual(SUPPRESS_FOREGROUND);
  });
});
