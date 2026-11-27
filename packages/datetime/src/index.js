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
