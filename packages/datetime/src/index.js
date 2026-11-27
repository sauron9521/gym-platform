import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfWeek } from 'date-fns/endOfWeek';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { tz } from '@date-fns/tz/tz';

// Narrow wire contract: a four-digit Gregorian date with an explicit UTC
// designator or numeric offset. parseISO alone also accepts partial dates,
// 24:00 and some out-of-range offsets; none are valid in this contract.
const instantPattern =
  /^(\d{4})-\d{2}-\d{2}T(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2}))$/;

/** Returns a new absolute Date or null; never guesses a timezone. */
export function parseInstant(value) {
  if (typeof value !== 'string') return null;
  const match = instantPattern.exec(value);
  if (
    !match ||
    Number(match[1]) < 1 ||
    Number(match[2]) > 23 ||
    (match[3] !== 'Z' && (Number(match[4]) > 23 || Number(match[5]) > 59))
  )
    return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** Accept UTC and supported named IANA zones, not numeric offset zones. */
export function isIanaTimezone(value) {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    (value !== 'UTC' && !/^[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?$/.test(value))
  )
    return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Civil date in an explicit named zone, or in the current device-local
 * zone when omitted. An unsupported explicit zone fails closed. */
export function calendarDayKey(instant, timeZone) {
  const date = parseInstant(instant);
  if (!date) return null;
  try {
    if (timeZone !== undefined && !isIanaTimezone(timeZone)) return null;
    const key =
      timeZone === undefined
        ? format(date, 'yyyy-MM-dd')
        : format(date, 'yyyy-MM-dd', { in: tz(timeZone) });
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
  } catch {
    // Some native Intl runtimes cannot resolve named-zone offsets.
    return null;
  }
}

// Device-local civil calendar. Months are zero-based, weeks start Monday.
// Civil dates and absolute instants are intentionally different contracts.
const monday = { weekStartsOn: 1 };

export function monthOf(date) {
  if (!isValid(date)) throw new RangeError('Invalid calendar date');
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function calendarMonthStart({ year, month }) {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 11
  )
    throw new RangeError('Invalid calendar month');
  // parseISO of a date-only value is deliberate here: local civil date,
  // never use this path to parse API timestamps.
  return startOfMonth(
    parseISO(String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0') + '-01'),
  );
}

export function shiftCalendarMonth(month, delta) {
  if (!Number.isSafeInteger(delta)) throw new RangeError('Invalid month shift');
  const next = monthOf(addMonths(calendarMonthStart(month), delta));
  // Reject overflow beyond the supported civil-year range.
  calendarMonthStart(next);
  return next;
}

export function localCalendarDayKey(date) {
  if (!(date instanceof Date) || !isValid(date)) throw new RangeError('Invalid calendar date');
  return format(date, 'yyyy-MM-dd');
}

export function shiftCalendarDays(date, days) {
  if (!isValid(date) || !Number.isSafeInteger(days)) throw new RangeError('Invalid day shift');
  const shifted = startOfDay(addDays(date, days));
  if (!isValid(shifted)) throw new RangeError('Invalid calendar date');
  return shifted;
}

export function startCalendarWeek(date) {
  if (!isValid(date)) throw new RangeError('Invalid calendar date');
  return startOfWeek(date, monday);
}

// Use an inclusive UTC upper bound for the existing scheduledTo API.
// The next civil boundary, rather than elapsed 24h arithmetic, is authoritative.
function inclusiveBounds(start, next) {
  return { from: start.toISOString(), to: new Date(next.getTime() - 1).toISOString() };
}

export function calendarMonthBounds(month) {
  return inclusiveBounds(
    calendarMonthStart(month),
    calendarMonthStart(shiftCalendarMonth(month, 1)),
  );
}

export function calendarPeriodBounds(period) {
  if (!('weekStart' in period)) return calendarMonthBounds(period);
  const start = startCalendarWeek(period.weekStart);
  return inclusiveBounds(start, shiftCalendarDays(start, 7));
}

function cellsBetween(start, end, inMonth) {
  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    key: localCalendarDayKey(date),
    inMonth: inMonth(date),
  }));
}

export function calendarMonthCells(month) {
  const start = calendarMonthStart(month);
  return cellsBetween(
    startCalendarWeek(start),
    endOfWeek(endOfMonth(start), monday),
    (date) => date.getMonth() === month.month && date.getFullYear() === month.year,
  );
}

export function calendarWeekCells(date) {
  return cellsBetween(startCalendarWeek(date), endOfWeek(date, monday), () => true);
}

/** Stable chronological grouping; skip absent/invalid absolute evidence.
 * No mutations of input rows, and no domain/status interpretation. */
export function groupByCalendarDay(items, getInstant) {
  const entries = [];
  for (const item of items) {
    const date = parseInstant(getInstant(item));
    if (date) entries.push({ item, date });
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  const groups = new Map();
  for (const { item, date } of entries) {
    const key = localCalendarDayKey(date);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
