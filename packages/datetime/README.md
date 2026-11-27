# @gym/datetime

Framework-neutral technical datetime operations for OVRANTO. Native ESM
and public TypeScript declarations; no build step or ambient global
timezone mutation. Uses date-fns 4.4.0 and @date-fns/tz 1.5.0.

- `parseInstant`: strict offset-bearing ISO timestamps, or null.
- `isIanaTimezone`: supported named IANA timezone or UTC; not fixed
  offset strings or a guess from the device locale.
- `calendarDayKey`: civil date in a caller-supplied named zone,
  or local device time when omitted; fails closed on invalid evidence.

Business rules belong in @gym/domain; timezone preferences and consent
remain API-owned. This package does not schedule work, resolve ambiguous
wall-clock input, authorize actions or implement retry/lease deadlines.
Do not use a calendar-day operation as an elapsed-time timer.

Run `pnpm --filter @gym/datetime test`. Named-zone behavior requires
Intl support; the Expo native named-zone and polyfill decision is
separate from the local calendar consumer. Device QA is still required.
