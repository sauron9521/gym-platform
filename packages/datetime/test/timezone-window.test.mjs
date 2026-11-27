import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  minuteOfDayInTimezone,
  isMinuteInDailyWindow,
  subtractElapsedMinutes,
} from '@gym/datetime';

test('projects real instants to civil minutes without implicit local zone', () => {
  for (const [iso, zone, expected] of [
    ['2026-11-27T00:00:00Z', 'UTC', 0],
    ['2026-11-27T23:59:59.999Z', 'UTC', 1439],
    ['2026-11-27T20:00:00Z', 'Europe/Kyiv', 1320],
    ['2026-11-27T06:15:00Z', 'Asia/Kathmandu', 720],
    ['2026-11-27T00:00:00Z', 'America/St_Johns', 1230],
    ['2026-11-27T23:30:00Z', 'Pacific/Kiritimati', 810],
    ['2026-11-01T05:30:00Z', 'America/New_York', 90],
    ['2026-11-01T06:30:00Z', 'America/New_York', 90],
    ['2026-03-08T06:59:59Z', 'America/New_York', 119],
    ['2026-03-08T07:00:00Z', 'America/New_York', 180],
    ['2018-11-04T02:59:59Z', 'America/Sao_Paulo', 1439],
    ['2018-11-04T03:00:00Z', 'America/Sao_Paulo', 60],
  ])
    assert.equal(minuteOfDayInTimezone(new Date(iso), zone), expected, iso + ' ' + zone);
});

test('unsupported zones and invalid instants never fall back to local time', () => {
  for (const zone of [null, undefined, '', 'GMT', 'Invalid/Zone', '+02:00', 7])
    assert.equal(minuteOfDayInTimezone(new Date(), zone), null);
  for (const instant of [null, undefined, '2026-11-27T00:00:00Z', new Date(NaN)])
    assert.equal(minuteOfDayInTimezone(instant, 'UTC'), null);
});

test('same-day and wrapping windows have inclusive start and exclusive end', () => {
  for (const [minute, expected] of [
    [1319, false],
    [1320, true],
    [1439, true],
    [0, true],
    [479, true],
    [480, false],
  ])
    assert.equal(isMinuteInDailyWindow(minute, 1320, 480), expected);
  for (const [minute, expected] of [
    [719, false],
    [720, true],
    [779, true],
    [780, false],
  ])
    assert.equal(isMinuteInDailyWindow(minute, 720, 780), expected);
  for (const args of [
    [0, 0, 0],
    [1440, 0, 1],
    [-1, 0, 1],
    [1, 0.5, 2],
    [1, 0, 1440],
    [NaN, 0, 1],
  ])
    assert.equal(isMinuteInDailyWindow(...args), null);
});

test('elapsed-minute subtraction is absolute across DST and does not mutate input', () => {
  for (const iso of ['2026-03-29T12:00:00Z', '2026-10-25T12:00:00Z']) {
    const original = new Date(iso);
    const result = subtractElapsedMinutes(original, 1440);
    assert.equal(original.getTime() - result.getTime(), 86400000);
    assert.equal(original.toISOString(), new Date(iso).toISOString());
    assert.notEqual(subtractElapsedMinutes(original, 0), original);
  }
  for (const minutes of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER])
    assert.equal(subtractElapsedMinutes(new Date(), minutes), null);
  assert.equal(subtractElapsedMinutes(new Date(NaN), 60), null);
  assert.equal(subtractElapsedMinutes(new Date(-8640000000000000), 1), null);
});
