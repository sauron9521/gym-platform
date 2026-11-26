export type CalendarMonth = Readonly<{ year: number; month: number }>;

export function monthOf(date: Date): CalendarMonth {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftCalendarMonth(month: CalendarMonth, delta: number): CalendarMonth {
  return monthOf(new Date(month.year, month.month + delta, 1));
}

/** Match the web calendar: device-local midnight, inclusive API upper bound. */
export function calendarMonthBounds(month: CalendarMonth) {
  const from = new Date(month.year, month.month, 1);
  const to = new Date(new Date(month.year, month.month + 1, 1).getTime() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function localWorkoutDayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calendarMonthCells(month: CalendarMonth) {
  const first = new Date(month.year, month.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(month.year, month.month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const date = new Date(month.year, month.month, index - offset + 1);
    return { date, key: localWorkoutDayKey(date), inMonth: date.getMonth() === month.month };
  });
}

export function groupScheduledWorkouts<T extends { scheduledAt: string }>(workouts: readonly T[]) {
  const days = new Map<string, T[]>();
  for (const item of [...workouts].sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
  )) {
    const key = localWorkoutDayKey(new Date(item.scheduledAt));
    const group = days.get(key);
    if (group) group.push(item);
    else days.set(key, [item]);
  }
  return days;
}

export type CalendarPeriod = CalendarMonth | Readonly<{ weekStart: Date }>;

/** Calendar arithmetic uses local dates, never fixed 24-hour durations (DST). */
export function shiftCalendarDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startCalendarWeek(date: Date) {
  return shiftCalendarDays(date, -((date.getDay() + 6) % 7));
}

export function calendarWeekCells(date: Date) {
  const start = startCalendarWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftCalendarDays(start, index);
    return { date: day, key: localWorkoutDayKey(day), inMonth: true };
  });
}

export function calendarPeriodBounds(period: CalendarPeriod) {
  if (!('weekStart' in period)) return calendarMonthBounds(period);
  const start = startCalendarWeek(period.weekStart);
  return {
    from: start.toISOString(),
    to: new Date(shiftCalendarDays(start, 7).getTime() - 1).toISOString(),
  };
}
