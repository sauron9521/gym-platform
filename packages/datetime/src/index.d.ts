export declare function parseInstant(value: unknown): Date | null;
export declare function isIanaTimezone(value: unknown): value is string;
export declare function calendarDayKey(instant: unknown, timeZone?: string): string | null;

export type CalendarMonth = Readonly<{ year: number; month: number }>;
export type CalendarPeriod = CalendarMonth | Readonly<{ weekStart: Date }>;
export type CalendarCell = Readonly<{ date: Date; key: string; inMonth: boolean }>;
export type CalendarBounds = Readonly<{ from: string; to: string }>;
export declare function monthOf(date: Date): CalendarMonth;
export declare function calendarMonthStart(month: CalendarMonth): Date;
export declare function shiftCalendarMonth(month: CalendarMonth, delta: number): CalendarMonth;
export declare function localCalendarDayKey(date: Date): string;
export declare function shiftCalendarDays(date: Date, days: number): Date;
export declare function startCalendarWeek(date: Date): Date;
export declare function calendarMonthBounds(month: CalendarMonth): CalendarBounds;
export declare function calendarPeriodBounds(period: CalendarPeriod): CalendarBounds;
export declare function calendarMonthCells(month: CalendarMonth): CalendarCell[];
export declare function calendarWeekCells(date: Date): CalendarCell[];
export declare function groupByCalendarDay<T>(
  items: readonly T[],
  getInstant: (item: T) => unknown,
): Map<string, T[]>;

export declare function minuteOfDayInTimezone(instant: Date, timeZone: unknown): number | null;
export declare function isMinuteInDailyWindow(
  minute: number,
  start: number,
  end: number,
): boolean | null;
export declare function subtractElapsedMinutes(instant: Date, minutes: number): Date | null;

export declare function utcCalendarDaysStart(asOf: Date, days: number): Date;
export declare function rollingDaysStart(asOf: Date, days: number): Date;
