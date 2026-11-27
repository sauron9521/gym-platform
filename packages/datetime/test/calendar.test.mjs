import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import {
  calendarMonthBounds,
  calendarMonthCells,
  calendarMonthStart,
  calendarPeriodBounds,
  calendarWeekCells,
  groupByCalendarDay,
  localCalendarDayKey,
  monthOf,
  shiftCalendarDays,
  shiftCalendarMonth,
  startCalendarWeek,
} from '@gym/datetime';

test('calendar months retain zero-based indices across years and leap days', () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 0 }, 25), { year: 2028, month: 1 });
  const month = { year: 2028, month: 1 };
  const cells = calendarMonthCells(month);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 29);
  assert.equal(cells[0].date.getDay(), 1);
  assert.equal(cells.at(-1).date.getDay(), 0);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.find((cell) => cell.key === '2028-02-29').inMonth, true);
  assert.deepEqual(monthOf(calendarMonthStart(month)), month);
});

test('week starts Monday and spans a year boundary without mutating anchor', () => {
  const anchor = new Date(2027, 0, 3, 12, 34);
  const original = anchor.getTime();
  assert.deepEqual(
    calendarWeekCells(anchor).map((cell) => cell.key),
    [
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ],
  );
  assert.equal(localCalendarDayKey(startCalendarWeek(anchor)), '2026-12-28');
  assert.equal(localCalendarDayKey(shiftCalendarDays(anchor, 7)), '2027-01-10');
  assert.equal(shiftCalendarDays(anchor, 7).getHours(), 0);
  assert.equal(anchor.getTime(), original);
});

test('month bounds are exactly inclusive through next local month minus one millisecond', () => {
  const month = { year: 2026, month: 11 };
  const bounds = calendarMonthBounds(month);
  assert.equal(bounds.from, calendarMonthStart(month).toISOString());
  assert.equal(Date.parse(bounds.to) + 1, calendarMonthStart({ year: 2027, month: 0 }).getTime());
  assert.deepEqual(calendarPeriodBounds(month), bounds);
});

test('grouping is chronological and stable for equal instants, rejects ambiguous evidence and never mutates rows', () => {
  const local = new Date(2026, 10, 27, 12);
  const later = new Date(2026, 10, 27, 15);
  const next = new Date(2026, 10, 28, 0, 1);
  const rows = Object.freeze([
    Object.freeze({ id: 'later', at: later.toISOString() }),
    Object.freeze({ id: 'first', at: local.toISOString() }),
    Object.freeze({ id: 'same', at: local.toISOString() }),
    Object.freeze({ id: 'next', at: next.toISOString() }),
    Object.freeze({ id: 'missing', at: null }),
    Object.freeze({ id: 'invalid', at: '2026-02-30T10:00:00Z' }),
    Object.freeze({ id: 'ambiguous', at: '2026-11-27T10:00:00' }),
  ]);
  const result = groupByCalendarDay(rows, (row) => row.at);
  assert.deepEqual([...result.keys()], ['2026-11-27', '2026-11-28']);
  assert.deepEqual(
    result.get('2026-11-27').map((row) => row.id),
    ['first', 'same', 'later'],
  );
  assert.equal(result.get('2026-11-28')[0], rows[3]);
  assert.equal(rows[0].id, 'later');
});

test('invalid programmer inputs do not silently normalize to a different period', () => {
  for (const month of [
    { year: 2026, month: 12 },
    { year: 2026, month: -1 },
    { year: 2026.5, month: 1 },
    { year: 0, month: 0 },
  ])
    assert.throws(() => calendarMonthStart(month), RangeError);
  assert.throws(() => shiftCalendarMonth({ year: 2026, month: 0 }, 0.5), RangeError);
  assert.throws(() => shiftCalendarDays(new Date(), NaN), RangeError);
  assert.throws(() => localCalendarDayKey(new Date(NaN)), RangeError);
  assert.throws(() => startCalendarWeek(new Date(NaN)), RangeError);
});

// Separate processes give each case an actual device-local timezone;
// never mutate global TZ in a test running alongside another test.
for (const [zone, spring, autumn, marchHours, octoberHours] of [
  ['UTC', '2026-03-23T00:00:00.000Z', '2026-10-19T00:00:00.000Z', 744, 744],
  ['Europe/Kyiv', '2026-03-22T22:00:00.000Z', '2026-10-18T21:00:00.000Z', 743, 745],
  ['America/Los_Angeles', '2026-03-23T07:00:00.000Z', '2026-10-19T07:00:00.000Z', 743, 744],
  ['Asia/Kathmandu', '2026-03-22T18:15:00.000Z', '2026-10-18T18:15:00.000Z', 744, 744],
]) {
  test('real local calendar boundaries in ' + zone, () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { calendarMonthBounds, calendarMonthCells, calendarPeriodBounds, calendarWeekCells, calendarDayKey } from '@gym/datetime';
      const spring=new Date(2026,2,29,12), autumn=new Date(2026,9,25,12);
      assert.equal(calendarPeriodBounds({weekStart:spring}).from,${JSON.stringify(spring)});
      assert.equal(calendarPeriodBounds({weekStart:autumn}).from,${JSON.stringify(autumn)});
      for (const [month,hours] of [[2,${marchHours}],[9,${octoberHours}]]) {
        const bounds=calendarMonthBounds({year:2026,month});
        assert.equal((Date.parse(bounds.to)+1-Date.parse(bounds.from))/3600000,hours);
        const cells=calendarMonthCells({year:2026,month});
        assert.equal(cells.length%7,0);
        assert.equal(cells.filter(c=>c.inMonth).length,31);
        assert.equal(new Set(cells.map(c=>c.key)).size,cells.length);
        for (const cell of cells) assert.equal(calendarDayKey(cell.date.toISOString()),cell.key);
      }
      for (const anchor of [spring,autumn]) {
        const cells=calendarWeekCells(anchor);
        assert.equal(cells.length,7);
        assert.equal(cells[0].date.getDay(),1);
        assert.equal(cells[6].date.getDay(),0);
        const bounds=calendarPeriodBounds({weekStart:anchor});
        assert.equal(bounds.from,cells[0].date.toISOString());
        const next=new Date(cells[6].date.getFullYear(),cells[6].date.getMonth(),cells[6].date.getDate()+1);
        assert.equal(Date.parse(bounds.to)+1,next.getTime());
      }
    `,
      ],
      { env: { ...process.env, TZ: zone }, stdio: 'pipe' },
    );
  });
}

test('midnight DST gap starts at the first valid local time, then returns to midnight', () => {
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { calendarWeekCells,calendarPeriodBounds,shiftCalendarDays } from '@gym/datetime';
    const anchor=new Date(2018,10,4,12);
    const cells=calendarWeekCells(anchor);
    assert.equal(cells.length,7);
    assert.equal(cells[6].key,'2018-11-04');
    assert.equal(cells[6].date.getHours(),1);
    assert.equal(shiftCalendarDays(cells[6].date,1).getHours(),0);
    assert.equal(calendarPeriodBounds({weekStart:anchor}).to,'2018-11-05T01:59:59.999Z');
  `,
    ],
    { env: { ...process.env, TZ: 'America/Sao_Paulo' }, stdio: 'pipe' },
  );
});
