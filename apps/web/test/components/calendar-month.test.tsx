import { describe, expect, it } from 'vitest';
import {
  calendarMonthBounds,
  calendarMonthCells,
  calendarDayKey,
  shiftCalendarMonth,
} from '@gym/datetime';

describe('workout calendar month utilities', () => {
  it('crosses year boundaries without skipping months', () => {
    expect(shiftCalendarMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftCalendarMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('computes inclusive bounds for every day of a leap-year February', () => {
    const bounds = calendarMonthBounds({ year: 2028, month: 1 });
    expect(new Date(bounds.to).getTime() + 1 - new Date(bounds.from).getTime()).toBe(
      29 * 24 * 60 * 60 * 1000,
    );
  });

  it('starts weeks on Monday and pads the grid with neighboring dates', () => {
    const cells = calendarMonthCells({ year: 2026, month: 10 });
    expect(cells.length % 7).toBe(0);
    expect(cells.some((day) => day.key === '2026-11-01' && day.inMonth)).toBe(true);
    expect(cells[0].key).toBe('2026-10-26');
  });

  it('treats month upper bound as one millisecond before next local month', () => {
    for (const value of [
      { year: 2026, month: 2 },
      { year: 2026, month: 9 },
    ]) {
      const bounds = calendarMonthBounds(value);
      const next = shiftCalendarMonth(value, 1);
      expect(new Date(bounds.to).getTime() + 1).toBe(new Date(next.year, next.month, 1).getTime());
      expect(new Date(bounds.from).getTime()).toBe(new Date(value.year, value.month, 1).getTime());
    }
  });

  it('uses local day keys at midnight without slicing UTC timestamps', () => {
    const localMidnight = new Date(2026, 10, 15, 0, 0, 0).toISOString();
    expect(calendarDayKey(localMidnight)).toBe('2026-11-15');
  });

  it('rejects invalid scheduled timestamps', () => {
    expect(calendarDayKey('invalid')).toBeNull();
    expect(calendarDayKey('2026-11-15T12:00:00.000Z')).not.toBeNull();
  });
});
