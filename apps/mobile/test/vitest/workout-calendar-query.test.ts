import { describe, expect, it, vi } from 'vitest';

import {
  calendarMonthBounds,
  calendarMonthCells,
  calendarPeriodBounds,
  calendarWeekCells,
  startCalendarWeek,
  shiftCalendarDays,
  type CalendarPeriod,
  groupByCalendarDay,
  localCalendarDayKey,
  shiftCalendarMonth,
} from '@gym/datetime';
import {
  calendarQueryKey,
  readWorkoutCalendar,
} from '@/features/workouts/model/workout-calendar-query';
import type { createMobileApi } from '@/shared/api/client';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const month = { year: 2024, month: 1 };
const scheduledAt = new Date(2024, 1, 15, 12).toISOString();
const item = (index: number) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  athleteId: ownerId,
  title: `Workout ${index}`,
  status: 'PLANNED',
  scheduledAt,
});
const page = (data: unknown[], total: number, skip = 0) => ({
  response: { status: 200 },
  data: { data, meta: { total, skip, take: 100, totalPages: Math.ceil(total / 100) } },
});
function harness(...responses: unknown[]) {
  const get = vi.fn();
  for (const response of responses) get.mockResolvedValueOnce(response);
  const controller = new AbortController();
  const onExpired = vi.fn(async () => undefined);
  const isCurrent = vi.fn(() => true);
  const run = (period: CalendarPeriod = month) =>
    readWorkoutCalendar({
      api: { GET: get } as unknown as ReturnType<typeof createMobileApi>,
      ownerId,
      period,
      signal: controller.signal,
      isCurrent,
      onExpired,
    });
  return { get, controller, onExpired, isCurrent, run };
}
describe('calendar local date semantics', () => {
  it('uses local month bounds with inclusive final millisecond and leap day', () => {
    const bounds = calendarMonthBounds(month);
    expect(new Date(bounds.from)).toEqual(new Date(2024, 1, 1));
    expect(new Date(bounds.to)).toEqual(new Date(2024, 2, 1, 0, 0, 0, -1));
    const cells = calendarMonthCells(month);
    expect(cells[0]?.date.getDay()).toBe(1);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(29);
    expect(cells.some((cell) => cell.key === '2024-02-29')).toBe(true);
    expect(cells.length % 7).toBe(0);
  });
  it('crosses year boundaries and groups by scheduled local date, sorting by time', () => {
    expect(shiftCalendarMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftCalendarMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    const first = { scheduledAt: new Date(2024, 1, 1, 0, 5).toISOString(), title: 'Early' };
    const later = { scheduledAt: new Date(2024, 1, 1, 23, 55).toISOString(), title: 'Late' };
    expect(localCalendarDayKey(new Date(first.scheduledAt))).toBe('2024-02-01');
    expect(
      groupByCalendarDay([later, first], (item) => item.scheduledAt).get('2024-02-01'),
    ).toEqual([first, later]);
  });
});
describe('calendar bounded authenticated read', () => {
  it('fetches every page using summary and local date bounds, scoped to owner cache', async () => {
    const first = Array.from({ length: 100 }, (_, i) => item(i + 1));
    const h = harness(page(first, 101), page([item(101)], 101, 100));
    expect(await h.run()).toHaveLength(101);
    const bounds = calendarMonthBounds(month);
    expect(h.get).toHaveBeenNthCalledWith(2, '/workouts', {
      signal: h.controller.signal,
      params: {
        query: {
          page: 2,
          limit: 100,
          view: 'summary',
          scheduledFrom: bounds.from,
          scheduledTo: bounds.to,
        },
      },
    });
    expect(calendarQueryKey(ownerId, month)).toEqual([
      'account',
      'workouts',
      ownerId,
      'calendar',
      bounds.from,
      bounds.to,
    ]);
    expect(calendarQueryKey(otherOwner, month)).not.toEqual(calendarQueryKey(ownerId, month));
  });
  it('supports zero results without requesting extra pages', async () => {
    const h = harness(page([], 0));
    expect(await h.run()).toEqual([]);
    expect(h.get).toHaveBeenCalledOnce();
  });
  it('fails closed on over-limit results, malformed metadata and changed totals', async () => {
    await expect(harness(page([], 1001)).run()).rejects.toMatchObject({ reason: 'tooMany' });
    await expect(harness(page([], 1)).run()).rejects.toMatchObject({ reason: 'incomplete' });
    const first = Array.from({ length: 100 }, (_, i) => item(i + 1));
    await expect(
      harness(page(first, 101), page([item(101), item(102)], 102, 100)).run(),
    ).rejects.toMatchObject({ reason: 'incomplete' });
  });
  it('rejects duplicates, foreign owners and out-of-range dates rather than partial results', async () => {
    await expect(harness(page([item(1), item(1)], 2)).run()).rejects.toMatchObject({
      reason: 'incomplete',
    });
    await expect(
      harness(page([{ ...item(1), athleteId: otherOwner }], 1)).run(),
    ).rejects.toMatchObject({ reason: 'incomplete' });
    await expect(
      harness(page([{ ...item(1), scheduledAt: new Date(2024, 2, 1).toISOString() }], 1)).run(),
    ).rejects.toMatchObject({ reason: 'incomplete' });
  });
  it('does not sign out on forbidden or stale 401; signs out on current 401', async () => {
    const denied = harness({ response: { status: 403 } });
    await expect(denied.run()).rejects.toMatchObject({ name: 'MobileAccessDeniedError' });
    expect(denied.onExpired).not.toHaveBeenCalled();
    const stale = harness();
    stale.get.mockImplementationOnce(async () => {
      stale.controller.abort();
      return { response: { status: 401 } };
    });
    await expect(stale.run()).rejects.toMatchObject({ reason: 'scopeChanged' });
    expect(stale.onExpired).not.toHaveBeenCalled();
    const expired = harness({ response: { status: 401 } });
    await expect(expired.run()).rejects.toMatchObject({ name: 'MobileSessionExpiredError' });
    expect(expired.onExpired).toHaveBeenCalledOnce();
  });
});

describe('calendar weekly boundaries and query', () => {
  it('includes seven local days across the year boundary, Monday through Sunday', () => {
    const sunday = new Date(2027, 0, 3, 23, 59);
    expect(startCalendarWeek(sunday)).toEqual(new Date(2026, 11, 28));
    const cells = calendarWeekCells(sunday);
    expect(cells.map((cell) => cell.key)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(cells.every((cell) => cell.inMonth)).toBe(true);
    expect(shiftCalendarDays(sunday, 7)).toEqual(new Date(2027, 0, 10));
  });

  it('uses local midnight boundaries rather than fixed elapsed hours over DST transitions', () => {
    for (const anchor of [new Date(2026, 2, 29, 12), new Date(2026, 9, 25, 12)]) {
      const bounds = calendarPeriodBounds({ weekStart: anchor });
      const start = startCalendarWeek(anchor);
      expect(new Date(bounds.from)).toEqual(start);
      expect(new Date(bounds.to).getTime()).toBe(shiftCalendarDays(start, 7).getTime() - 1);
      expect(calendarWeekCells(anchor).map((cell) => cell.date.getHours())).toEqual(
        Array(7).fill(0),
      );
    }
  });

  it('requests a single exact weekly range spanning two months and keeps keys distinct', async () => {
    const period = { weekStart: new Date(2026, 11, 28) };
    const first = { ...item(1), scheduledAt: new Date(2026, 11, 31, 23, 59).toISOString() };
    const second = { ...item(2), scheduledAt: new Date(2027, 0, 1, 0, 1).toISOString() };
    const h = harness(page([first, second], 2));
    expect(await h.run(period)).toEqual([first, second]);
    const bounds = calendarPeriodBounds(period);
    expect(h.get).toHaveBeenCalledExactlyOnceWith('/workouts', {
      signal: h.controller.signal,
      params: {
        query: {
          page: 1,
          limit: 100,
          view: 'summary',
          scheduledFrom: bounds.from,
          scheduledTo: bounds.to,
        },
      },
    });
    expect(calendarQueryKey(ownerId, period)).not.toEqual(
      calendarQueryKey(ownerId, { year: 2026, month: 11 }),
    );
    expect(calendarQueryKey(ownerId, period)).toEqual(
      calendarQueryKey(ownerId, { weekStart: new Date(2027, 0, 3) }),
    );
    expect(calendarQueryKey(otherOwner, period)).not.toEqual(calendarQueryKey(ownerId, period));
    const outside = harness(
      page([{ ...first, scheduledAt: new Date(2027, 0, 4).toISOString() }], 1),
    );
    await expect(outside.run(period)).rejects.toMatchObject({ reason: 'incomplete' });
  });
});
