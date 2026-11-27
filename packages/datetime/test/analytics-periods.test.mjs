import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { rollingDaysStart, utcCalendarDaysStart } from '@gym/datetime';

test('UTC calendar dates include the anchor UTC day, not rolling elapsed days', () => {
  for (const [anchor, days, expected] of [
    ['2026-11-09T23:59:59.999Z', 7, '2026-11-03T00:00:00.000Z'],
    ['2024-03-01T12:00:00Z', 7, '2024-02-24T00:00:00.000Z'],
    ['2026-01-01T00:02:00Z', 90, '2025-10-04T00:00:00.000Z'],
    ['2026-11-27T23:59:59.999Z', 1, '2026-11-27T00:00:00.000Z'],
  ]) {
    const date = new Date(anchor);
    const original = date.getTime();
    assert.equal(utcCalendarDaysStart(date, days).toISOString(), expected);
    assert.equal(date.getTime(), original);
    assert.equal(rollingDaysStart(date, days).getTime(), original - days * 86400000);
  }
});

test('invalid anchors and periods are rejected rather than normalized', () => {
  for (const helper of [utcCalendarDaysStart, rollingDaysStart]) {
    for (const days of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
      assert.throws(() => helper(new Date('2026-11-27T12:00:00Z'), days), RangeError);
    assert.throws(() => helper(new Date(NaN), 7), RangeError);
  }
});

for (const zone of ['UTC', 'Europe/Kyiv', 'America/Los_Angeles', 'Asia/Kathmandu']) {
  test('both UTC and rolling ranges ignore process TZ: ' + zone, () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { utcCalendarDaysStart,rollingDaysStart } from '@gym/datetime';
      for (const [anchor,expected] of [
        ['2026-03-29T12:34:56.789Z','2026-03-23T00:00:00.000Z'],
        ['2026-10-25T12:34:56.789Z','2026-10-19T00:00:00.000Z'],
      ]) {
        const date=new Date(anchor);
        assert.equal(utcCalendarDaysStart(date,7).toISOString(),expected);
        assert.equal(date.getTime()-rollingDaysStart(date,30).getTime(),30*86400000);
        assert.equal(date.toISOString(),anchor);
      }
    `,
      ],
      { env: { ...process.env, TZ: zone }, stdio: 'pipe' },
    );
  });
}
