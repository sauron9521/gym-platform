import { describe, expect, it } from 'vitest';
import {
  LOCAL_REMINDER_PLAN_LIMIT,
  planLocalReminders,
} from '../../src/features/notifications/lib/local-reminder-plan';

const ownerId = '10000000-0000-4000-8000-000000000001';
const id = (n: number) => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
const now = '2026-11-27T12:00:00.000Z';
const row = (n: number, scheduledAt = '2026-11-27T16:00:00.000Z') => ({
  id: id(n),
  athleteId: ownerId,
  status: 'PLANNED',
  scheduledAt,
  title: 'private workout',
});
const settings = {
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
  timezone: 'UTC',
  preferences: [
    {
      category: 'WORKOUT',
      channel: 'LOCAL_REMINDER',
      enabled: true,
      consentedAt: '2026-11-26T12:00:00.000Z',
    },
    { category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'PROGRAM', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'ACCOUNT', channel: 'EMAIL', enabled: false, consentedAt: null },
  ],
};
const input = {
  ownerId,
  now,
  permission: 'granted',
  snapshotComplete: true,
  settings,
  workouts: [row(1)],
};

describe('local reminder plan (no native effects)', () => {
  it('returns only scoped opaque identifiers and absolute due times, sorted and bounded', () => {
    const workouts = Array.from({ length: 40 }, (_, i) => row(40 - i));
    const original = JSON.stringify(workouts);
    const result = planLocalReminders({ ...input, workouts });
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.reminders).toHaveLength(LOCAL_REMINDER_PLAN_LIMIT);
    expect(result.reminders[0]).toEqual({ workoutId: id(1), dueAt: '2026-11-27T15:00:00.000Z' });
    expect(result.reminders.at(-1)?.workoutId).toBe(id(32));
    expect(JSON.stringify(workouts)).toBe(original);
    expect(JSON.stringify(result)).not.toContain('private workout');
  });
  it('skips terminal, started, expired and quiet reminders; empty complete snapshot is ready', () => {
    expect(
      planLocalReminders({
        ...input,
        workouts: [
          { ...row(1), status: 'COMPLETED' },
          { ...row(2), status: 'CANCELLED' },
          { ...row(3), status: 'IN_PROGRESS' },
          row(4, '2026-11-27T13:00:00Z'),
          row(5, '2026-11-27T23:00:00Z'),
          row(6),
        ],
      }),
    ).toEqual({
      kind: 'ready',
      reminders: [{ workoutId: id(6), dueAt: '2026-11-27T15:00:00.000Z' }],
    });
    expect(planLocalReminders({ ...input, workouts: [] })).toEqual({
      kind: 'ready',
      reminders: [],
    });
  });
  it.each(['denied', 'undetermined', 'unavailable', null, true])(
    'blocks without explicit OS grant: %s',
    (permission) => {
      expect(planLocalReminders({ ...input, permission })).toEqual({
        kind: 'blocked',
        reason: 'permission',
      });
    },
  );
  it('blocks wrong owner, duplicate, malformed or incomplete snapshots without partial plans', () => {
    for (const workouts of [
      [row(1), { ...row(2), athleteId: id(99) }],
      [row(1), row(1)],
      [row(1), row(2, '2026-02-30T16:00:00Z')],
      [row(1), row(2, '2026-11-27T16:00:00')],
      Array.from({ length: 1001 }, (_, i) => row(i)),
    ]) {
      expect(planLocalReminders({ ...input, workouts })).toEqual({
        kind: 'blocked',
        reason: 'snapshot',
      });
    }
    expect(planLocalReminders({ ...input, snapshotComplete: false })).toEqual({
      kind: 'blocked',
      reason: 'snapshot',
    });
    expect(planLocalReminders({ ...input, ownerId: null })).toEqual({
      kind: 'blocked',
      reason: 'scope',
    });
  });
  it('requires valid fresh consent evidence and usable account timezone even with quiet disabled', () => {
    for (const consent of [
      { enabled: false, consentedAt: null },
      { enabled: true, consentedAt: '2026-11-28T00:00:00Z' },
    ]) {
      expect(
        planLocalReminders({
          ...input,
          settings: {
            ...settings,
            preferences: [
              { ...settings.preferences[0], ...consent },
              ...settings.preferences.slice(1),
            ],
          },
        }),
      ).toEqual({ kind: 'blocked', reason: 'consent' });
    }
    for (const timezone of [null, 'Invalid/Zone', '+02:00']) {
      expect(
        planLocalReminders({
          ...input,
          settings: { ...settings, timezone, quietHoursEnabled: false },
        }),
      ).toEqual({ kind: 'blocked', reason: 'settings' });
    }
    expect(
      planLocalReminders({ ...input, settings: { ...settings, quietEndMinute: 1320 } }),
    ).toEqual({ kind: 'blocked', reason: 'settings' });
  });
  it('uses account civil minute for quiet hours and exactly 1440 elapsed minutes across DST', () => {
    expect(
      planLocalReminders({
        ...input,
        settings: { ...settings, timezone: 'Europe/Kyiv' },
        workouts: [row(1, '2026-11-27T21:00:00Z')],
      }),
    ).toEqual({ kind: 'ready', reminders: [] });
    expect(
      planLocalReminders({
        ...input,
        now: '2026-03-27T12:00:00Z',
        settings: {
          ...settings,
          timezone: 'Europe/Kyiv',
          reminderLeadMinutes: 1440,
          quietHoursEnabled: false,
          preferences: [
            { ...settings.preferences[0], consentedAt: '2026-03-01T00:00:00Z' },
            ...settings.preferences.slice(1),
          ],
        },
        workouts: [row(1, '2026-03-29T12:00:00Z')],
      }),
    ).toEqual({
      kind: 'ready',
      reminders: [{ workoutId: id(1), dueAt: '2026-03-28T12:00:00.000Z' }],
    });
  });
});
