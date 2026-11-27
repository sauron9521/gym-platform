import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workoutCalendarStatus, workoutCalendarDayKey, workoutStatuses } from '@gym/domain';

const scheduledAt = '2026-10-25T08:00:00.000Z';
const planned = { status: 'PLANNED', scheduledAt };

test('missed starts on the next calendar day, not the scheduled minute', () => {
  assert.equal(
    workoutCalendarStatus(planned, '2026-10-25T21:59:59.999Z', 'Europe/Kyiv'),
    'PLANNED',
  );
  assert.equal(workoutCalendarStatus(planned, '2026-10-25T22:00:00.000Z', 'Europe/Kyiv'), 'MISSED');
  assert.equal(
    workoutCalendarStatus(planned, '2026-10-24T12:00:00.000Z', 'Europe/Kyiv'),
    'PLANNED',
  );
});

test('completed late compares civil day; same day, early and missing completions stay completed', () => {
  const complete = (completedAt) =>
    workoutCalendarStatus(
      { status: 'COMPLETED', scheduledAt, completedAt },
      '2026-10-28T00:00:00Z',
      'Europe/Kyiv',
    );
  assert.equal(complete('2026-10-25T20:00:00Z'), 'COMPLETED');
  assert.equal(complete('2026-10-25T22:00:00Z'), 'COMPLETED_LATE');
  assert.equal(complete('2026-10-24T20:00:00Z'), 'COMPLETED');
  assert.equal(complete(null), 'COMPLETED');
  assert.equal(complete('2026-10-29T00:00:00Z'), 'COMPLETED');
});

test('DST spring gap and autumn repeated hour are real instants in the same local date', () => {
  for (const [before, after, expected] of [
    ['2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z', '2026-03-29'],
    ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25'],
  ]) {
    assert.equal(workoutCalendarDayKey(before, 'Europe/Kyiv'), expected);
    assert.equal(workoutCalendarDayKey(after, 'Europe/Kyiv'), expected);
  }
  assert.equal(
    workoutCalendarStatus(
      { status: 'PLANNED', scheduledAt: '2026-03-28T22:00:00Z' },
      '2026-03-29T20:59:59.999Z',
      'Europe/Kyiv',
    ),
    'PLANNED',
  );
  assert.equal(
    workoutCalendarStatus(
      { status: 'PLANNED', scheduledAt: '2026-03-28T22:00:00Z' },
      '2026-03-29T21:00:00Z',
      'Europe/Kyiv',
    ),
    'MISSED',
  );
});

test('explicit calendar zones distinguish UTC midnight, offset timestamps and date line', () => {
  const stamp = '2026-11-27T00:30:00Z';
  assert.equal(workoutCalendarDayKey(stamp, 'America/Los_Angeles'), '2026-11-26');
  assert.equal(workoutCalendarDayKey(stamp, 'Pacific/Kiritimati'), '2026-11-27');
  assert.equal(workoutCalendarDayKey('2026-11-26T16:30:00-08:00', 'UTC'), '2026-11-27');
  assert.equal(workoutCalendarDayKey('2026-11-27T23:30:00Z', 'Pacific/Kiritimati'), '2026-11-28');
});

test('missing or malformed timestamps and zone fail to the canonical status', () => {
  for (const value of [
    null,
    undefined,
    'invalid',
    '2026-11-27T10:30:00',
    '2026-02-30T12:00:00Z',
    '2026-11-27T24:00:00Z',
    '2026-11-27',
  ]) {
    assert.equal(workoutCalendarDayKey(value, 'UTC'), null);
    assert.equal(
      workoutCalendarStatus({ ...planned, scheduledAt: value }, '2026-11-28T00:00:00Z', 'UTC'),
      'PLANNED',
    );
  }
  assert.equal(workoutCalendarStatus(planned, 'invalid', 'UTC'), 'PLANNED');
  assert.equal(workoutCalendarStatus(planned, '2026-11-28T00:00:00Z', 'Invalid/Zone'), 'PLANNED');
});

test('canonical terminal and in-progress statuses are unchanged; input not mutated', () => {
  for (const status of ['IN_PROGRESS', 'CANCELLED']) {
    const input = Object.freeze({ status, scheduledAt });
    assert.equal(workoutCalendarStatus(input, '2026-11-28T00:00:00Z', 'UTC'), status);
    assert.deepEqual(input, { status, scheduledAt });
  }
  assert.deepEqual(workoutStatuses, ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
});
