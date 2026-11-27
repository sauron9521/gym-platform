import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notificationQuietHoursAt,
  workoutReminderDueAt,
  workoutReminderLeadMinutes,
} from '@gym/domain';
const settings = {
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
};
const input = {
  status: 'PLANNED',
  scheduledAt: new Date('2026-11-27T16:00:00Z'),
  now: new Date('2026-11-27T12:00:00Z'),
  timezone: 'UTC',
  settings,
  consent: true,
};

test('shared lead presets and future reminder eligibility', () => {
  assert.deepEqual(workoutReminderLeadMinutes, [15, 60, 1440]);
  assert.equal(workoutReminderDueAt(input)?.toISOString(), '2026-11-27T15:00:00.000Z');
  assert.equal(
    workoutReminderDueAt({
      ...input,
      settings: { ...settings, reminderLeadMinutes: 15 },
    })?.toISOString(),
    '2026-11-27T15:45:00.000Z',
  );
  for (const changes of [
    { consent: false },
    { consent: 1 },
    { status: 'COMPLETED' },
    { status: 'IN_PROGRESS' },
    { status: 'CANCELLED' },
    { now: new Date('2026-11-27T15:00:00Z') },
    { scheduledAt: new Date(NaN) },
    { now: new Date(NaN) },
    { timezone: 'Invalid/Zone' },
    { settings: { ...settings, reminderLeadMinutes: 30 } },
  ]) {
    assert.equal(workoutReminderDueAt({ ...input, ...changes }), null);
  }
});

test('quiet periods skip rather than defer and invalid evidence fails closed', () => {
  assert.equal(
    workoutReminderDueAt({ ...input, scheduledAt: new Date('2026-11-27T23:00:00Z') }),
    null,
  );
  for (const zone of [null, 'Invalid/Zone', '+02:00'])
    assert.equal(
      notificationQuietHoursAt(input.now, zone, { ...settings, quietHoursEnabled: false }),
      'invalid',
    );
  assert.equal(
    notificationQuietHoursAt(input.now, 'UTC', {
      ...settings,
      quietStartMinute: 480,
      quietHoursEnabled: false,
    }),
    'invalid',
  );
  assert.equal(
    notificationQuietHoursAt(new Date('2026-11-27T08:00:00Z'), 'UTC', settings),
    'allowed',
  );
  assert.equal(
    notificationQuietHoursAt(new Date('2026-11-27T22:00:00Z'), 'UTC', settings),
    'quiet',
  );
});

test('DST folds and gaps use account zone; lead remains elapsed 24 hours', () => {
  const window = { ...settings, quietStartMinute: 60, quietEndMinute: 180 };
  for (const stamp of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'])
    assert.equal(notificationQuietHoursAt(new Date(stamp), 'America/New_York', window), 'quiet');
  assert.equal(
    notificationQuietHoursAt(new Date('2026-03-08T07:00:00Z'), 'America/New_York', window),
    'allowed',
  );
  const scheduledAt = new Date('2026-03-29T12:00:00Z');
  assert.equal(
    workoutReminderDueAt({
      ...input,
      scheduledAt,
      now: new Date('2026-03-01T00:00:00Z'),
      timezone: 'Europe/Kyiv',
      settings: { ...settings, quietHoursEnabled: false, reminderLeadMinutes: 1440 },
    })?.toISOString(),
    '2026-03-28T12:00:00.000Z',
  );
});
