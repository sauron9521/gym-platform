export type CalendarMonth = Readonly<{ year: number; month: number }>;

export function shiftCalendarMonth(value: CalendarMonth, delta: number): CalendarMonth {
  const date = new Date(value.year, value.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Local-time month bounds converted to wire ISO. Inclusive API scheduledTo. */
export function calendarMonthBounds(value: CalendarMonth) {
  const start = new Date(value.year, value.month, 1);
  const end = new Date(value.year, value.month + 1, 1).getTime() - 1;
  return { from: start.toISOString(), to: new Date(end).toISOString() };
}

export type CalendarCell = Readonly<{ dateKey: string; day: number; inMonth: boolean }>;

/** Fixed weekday rows starting Monday; date keys are local YYYY-MM-DD, never UTC-sliced. */
export function calendarMonthCells(value: CalendarMonth): CalendarCell[] {
  const start = new Date(value.year, value.month, 1);
  const offset = (start.getDay() + 6) % 7;
  const days = new Date(value.year, value.month + 1, 0).getDate();
  const length = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(value.year, value.month, index - offset + 1);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
      dateKey: `${year}-${month}-${day}`,
      day: date.getDate(),
      inMonth: date.getMonth() === value.month && date.getFullYear() === value.year,
    };
  });
}

export function localWorkoutDayKey(dateString: string): string | null {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
