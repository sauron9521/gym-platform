# @gym/datetime

Framework-neutral technical datetime operations for OVRANTO. Native ESM
and public TypeScript declarations; no build step or ambient global
timezone mutation. Uses date-fns 4.4.0 and @date-fns/tz 1.5.0.

- `parseInstant`: strict offset-bearing ISO timestamps, or null.
- `isIanaTimezone`: supported named IANA timezone or UTC; not fixed
  offset strings or a guess from the device locale.
- `calendarDayKey`: civil date in a caller-supplied named zone,
  or local device time when omitted; fails closed on invalid evidence.

- Calendar helpers: zero-based months, Monday-start weeks, local civil
  month/week grids, navigation and inclusive UTC API bounds. Local civil
  days may be 23/24/25 hours; do not derive them with elapsed-day math.
- `groupByCalendarDay`: stable chronological grouping of offset-bearing
  timestamps, skipping missing or malformed dates without mutating rows.

- `minuteOfDayInTimezone`: direct Intl civil minute projection in a
  verified account zone. No implicit local fallback.
- `isMinuteInDailyWindow`: half-open same-day or midnight-wrapping window.
- `subtractElapsedMinutes`: date-fns elapsed arithmetic; 1440 minutes
  always means 24 hours, not one civil day.

- `utcCalendarDaysStart`: last N UTC dates, including the anchor UTC day.
- `rollingDaysStart`: exactly N elapsed 24-hour periods before the anchor.
  Both reject invalid internal period inputs and return fresh dates.

Business rules belong in @gym/domain; timezone preferences and consent
remain API-owned. This package does not schedule work, resolve ambiguous
wall-clock input, authorize actions or implement retry/lease deadlines.
Do not use a calendar-day operation as an elapsed-time timer.

Run `pnpm --filter @gym/datetime test`. Named-zone behavior requires
Intl support; the Expo native named-zone and polyfill decision is
separate from the local calendar consumer. Device QA is still required.
