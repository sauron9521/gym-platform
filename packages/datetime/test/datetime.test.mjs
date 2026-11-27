import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDayKey, isIanaTimezone, parseInstant } from '@gym/datetime';

test('parses only explicit absolute ISO timestamp evidence', () => {
  for (const [input, expected] of [
    ['2026-11-27T10:30:00.000Z', '2026-11-27T10:30:00.000Z'],
    ['2026-11-27T10:30+02:00', '2026-11-27T08:30:00.000Z'],
    ['2024-02-29T23:15:30.123-03:30', '2024-03-01T02:45:30.123Z'],
    ['2026-11-27T10:30:00.123456Z', '2026-11-27T10:30:00.123Z'],
  ])
    assert.equal(parseInstant(input)?.toISOString(), expected);
  for (const input of [
    null,
    undefined,
    0,
    new Date(),
    '',
    '2026-11-27',
    '2026-11-27T10:30:00',
    '2026-02-30T12:00:00Z',
    '2025-02-29T12:00Z',
    '2026-11-27T24:00:00Z',
    '2026-11-27T12:60:00Z',
    '2026-11-27T12:00:60Z',
    '2026-11-27T12:00+24:00',
    '2026-11-27T12:00-99:00',
    '2026-11-27T12:00+01:60',
    '0000-01-01T00:00Z',
  ])
    assert.equal(parseInstant(input), null, String(input));
});

test('requires a supported named zone, not an implicit or fixed offset zone', () => {
  for (const zone of [
    'UTC',
    'Europe/Kyiv',
    'America/Los_Angeles',
    'Asia/Kathmandu',
    'Pacific/Kiritimati',
  ])
    assert.equal(isIanaTimezone(zone), true, zone);
  for (const zone of [undefined, null, '', 'Invalid/Zone', '+02:00', 'GMT', 42])
    assert.equal(isIanaTimezone(zone), false, String(zone));
});

test('calendar day uses local date or explicit named zone', () => {
  const instant = '2026-11-27T23:30:00.000Z';
  const local = new Date(instant);
  const key = [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, '0'),
    String(local.getDate()).padStart(2, '0'),
  ].join('-');
  assert.equal(calendarDayKey(instant), key);
  assert.equal(calendarDayKey(instant, 'UTC'), '2026-11-27');
  assert.equal(calendarDayKey(instant, 'Europe/Kyiv'), '2026-11-28');
  assert.equal(calendarDayKey('2026-11-27T00:30:00Z', 'America/Los_Angeles'), '2026-11-26');
  assert.equal(calendarDayKey('2026-11-27T18:20:00Z', 'Asia/Kathmandu'), '2026-11-28');
  assert.equal(calendarDayKey(instant, 'Pacific/Kiritimati'), '2026-11-28');
  assert.equal(calendarDayKey(instant, 'Invalid/Zone'), null);
  assert.equal(calendarDayKey(instant, '+02:00'), null);
  assert.equal(calendarDayKey('invalid', 'UTC'), null);
});

test('DST folds, gaps and midnight boundaries use actual instants', () => {
  for (const stamp of ['2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z'])
    assert.equal(calendarDayKey(stamp, 'Europe/Kyiv'), '2026-03-29');
  for (const stamp of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'])
    assert.equal(calendarDayKey(stamp, 'Europe/Kyiv'), '2026-10-25');
  assert.equal(calendarDayKey('2026-03-29T20:59:59.999Z', 'Europe/Kyiv'), '2026-03-29');
  assert.equal(calendarDayKey('2026-03-29T21:00:00.000Z', 'Europe/Kyiv'), '2026-03-30');
});

test('strict parsing produces fresh Date objects without shared mutable state', () => {
  const instant = '2026-11-27T00:00:00Z';
  const first = parseInstant(instant);
  first.setUTCFullYear(2000);
  assert.equal(parseInstant(instant).toISOString(), '2026-11-27T00:00:00.000Z');
});
