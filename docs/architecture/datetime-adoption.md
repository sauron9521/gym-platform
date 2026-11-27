# Datetime adoption — baseline and rollout

Baseline main a0de21c (#982), 2026-11-27. Owner approved date-fns and
@date-fns/tz adoption before local reminders (#342). One focused PR
per migration slice; no automatic production activation.

The existing lockfile contained date-fns 4.4.0 and Luxon 3.7.2 as
transitive dependencies, not direct application dependencies. Reuse
date-fns 4.4.0 and pin @date-fns/tz 1.5.0. Do not add another competing
date library. The initial search for Date construction/parsing/Intl
found 132 tracked source files across apps/packages, including tests.
This is a candidate inventory, not a count of code to replace.

| Area                                                            | Decision                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Domain workout calendar status (#341)                           | Adopt strict parse and civil day via shared datetime; keep business rule       |
| Web and Mobile calendar-month helpers                           | DT02: shared month/week arithmetic and DST boundaries                          |
| API notification settings and delivery policy                   | DT03: shared named-zone and daily-window helpers; preserve fail-closed consent |
| Mobile reminders (#342)                                         | Absolute elapsed-time lead; permission and device evidence before scheduling   |
| Progress, body measurement statistics, Trainer dashboard        | DT04: preserve UTC buckets and rolling elapsed comparison windows              |
| Admin and dashboard formatting                                  | Review existing locale formatting; keep Intl/next-intl when sufficient         |
| Auth session TTL, database lease/retention, monotonic deadlines | Keep existing clocks and absolute/SQL arithmetic; no cosmetic replacement      |

The initial package is tested with UTC, Kyiv DST boundaries, negative
and non-hour offsets, local day keys and invalid input. `parseISO`
is not a wire schema by itself: require a full date/time and explicit
offset, reject 24:00 and invalid offset ranges, then parse/validate.
Keep authorization, ownership, calendar status policy, consent and
session lifecycle outside the technical package.

[date-fns time zones](https://github.com/date-fns/date-fns/blob/main/pkgs/core/docs/timeZones.md)
and [@date-fns/tz](https://github.com/date-fns/tz) describe explicit
zone support and Hermes/FormatJS requirements. Local calendar operations
do not require an explicit named zone. Native named-zone support and
any required polyfills must be tested on supported Android/iOS builds;
do not infer physical-device success from JS tests or export alone.

## DT02 — shared device-local calendar

Web and Mobile consume the public `@gym/datetime` calendar helpers
directly, without duplicate app-local modules. Both use Monday-start
weeks, zero-based months, local calendar keys, stable chronological
grouping and inclusive UTC query bounds ending one millisecond before
the next local period. Device-local calendar display is unchanged;
account timezone and quiet-hour classification remain separate.
Malformed or ambiguous scheduled instants are omitted from grouping;
API ownership and pagination rules are unchanged. The grouping helper
does not mutate source data. Week/month navigation uses civil arithmetic,
not a fixed 24-hour duration.

Tests use actual process-local zones UTC, Europe/Kyiv,
America/Los_Angeles, Asia/Kathmandu and America/Sao_Paulo for leap days,
DST, midnight gaps, year transitions and non-hour offsets.
Historical skipped whole civil dates and physical device timezone
changes are not part of the supported acceptance matrix; native QA
remains #348/#349. No new external dependencies or OS permission work.

## DT03 — account timezone and quiet hours

The profile DTO and notification settings projection use the same public
`isIanaTimezone` validator. Shared datetime helpers project an actual
instant into a named-zone civil minute via Intl (without constructing
ambiguous wall-clock dates), classify half-open daily windows and use
date-fns `subMinutes` for elapsed reminder lead. Keep Intl field
projection rather than introducing a second timezone conversion for
hour/minute fields. Invalid projection fails closed, including when
quiet hours are disabled. Existing UTC default for an absent profile
remains; a corrupt stored zone is not silently converted to UTC.
Profile trimming, consent, settings validation, source eligibility,
database clock, lease and transport decisions remain API-owned.
1440 minutes means exactly 24 elapsed hours across DST. No scheduling
or provider activation is introduced.

## DT04 — analytics periods

Body measurement and workout chart ranges include the UTC date of
the server anchor and the preceding N-1 dates, with the same inclusive
upper bound at asOf. Use `utcCalendarDaysStart`. Keep SQL UTC bucketing,
latest-per-day selection, metric filters and transaction isolation.
The two historical API utility paths remain thin re-export adapters
for the immutable migration source inventory; no duplicated arithmetic.
Body measurement comparison baselines and Trainer Dashboard use
`rollingDaysStart`: exactly N elapsed 24-hour periods, never local
calendar days. Both measurement repository and service share that
cutoff calculation. No analytics query, ownership or metric change.

Trainer client progress and overview parse explicit offset-bearing
timestamps through the same strict helper. Both now require the exact
30-day rolling interval returned by the API; overview previously only
checked ordering. Malformed date/window responses fail closed rather
than displaying unverified KPI values. This is validation hardening,
not a change to legitimate API responses. No dependency version change.
UTC dates for birthday, SQL clock/retention, session and lease arithmetic
remain separate contracts and are intentionally not migrated here.

## DT05 — ownership, verification and remaining scope

The approved date library family is date-fns and @date-fns/tz in
`packages/datetime` only. Direct dependencies and literal imports
of the named competing libraries (date-fns-tz, other @date-fns
packages, Luxon, Day.js, Moment and the Temporal polyfill) are not
permitted without a reviewed architecture decision. Use the public
`@gym/datetime` exports instead. Keep this package a technical leaf;
it cannot depend on other workspaces. Transitive dependencies of
third-party packages may still occur in the lockfile.

The existing manifest contract and required Dependency Cruiser graph
gate enforce this ownership. They check all four dependency fields,
npm aliases, root/workspace manifests and resolved/unresolved literal
imports under src, app, test, tests and e2e directories. Dependency
edges into node_modules remain visible, but third-party implementation
code is not traversed. Computed imports and arbitrary new libraries
outside the named family are not exhaustively detected. Code review
remains responsible for semantic correctness and dependency approval.

### Choose a time contract before implementing

| Need                                   | Use                                                |
| -------------------------------------- | -------------------------------------------------- |
| Absolute API timestamp evidence        | parseInstant; require explicit offset              |
| Local calendar navigation and grouping | calendarMonth/Week helpers and groupByCalendarDay  |
| Explicit named-zone civil date/minute  | calendarDayKey and minuteOfDayInTimezone           |
| Quiet window                           | isMinuteInDailyWindow; consent stays in API policy |
| Elapsed lead                           | subtractElapsedMinutes                             |
| UTC chart buckets                      | utcCalendarDaysStart                               |
| Rolling 24-hour comparisons            | rollingDaysStart                                   |
| Date-only profile birthday             | Existing validated YYYY-MM-DD contract             |
| Localized display                      | Intl / next-intl / react-intl                      |
| Session TTL, lease, retry, retention   | Existing absolute, monotonic or database clock     |

Do not globally ban Date, Intl, SQL time functions or elapsed
millisecond arithmetic. Do not interpret an absolute timestamp as a
local wall clock or use UTC string slicing for a local calendar date.
New shared time operations require a focused test and explicit
timezone/elapsed/calendar semantics. Never infer a zone for corrupt
account data or guess how to resolve an ambiguous local appointment.

### Final inventory and follow-ups

DT01–DT04 migrated the targeted workout calendars/status, profile
timezone validation, quiet hours, reminder lead and analytics windows.
The manifest scan at main 88851ec found date-fns 4.4.0 and @date-fns/tz
1.5.0 declared only by datetime; no competing direct dependency.
The remaining day-sized constants in notification delivery TTL and
avatar cleanup are intentionally elapsed durations, not civil days.

Existing Admin directory/detail/inbox and Trainer program-selector
response date validation, Mobile calendar range validation and Web
next-planned-workout comparisons still contain Date.parse or native
Date. These are separate response-contract candidates, not proof
of a defect; review their accepted wire formats and tests before
changing them. Date-only birthday and simple localized display are
not migration targets. Historical imported API utility paths remain
thin adapters to avoid weakening the migration inventory.

The foundational adoption is ready for review, not a claim that every
date call has been migrated. Native named-zone support and native
timezone-change behavior remain device QA gates (#348/#349). Do not
install global polyfills or activate reminders without native evidence.
Next: #342 local reminder lifecycle, followed by #343 push only after
local scheduling is proven. No production readiness approval here.

## Other library candidates — not approved

- Expo Notifications: existing #342/#343 owns native permission,
  scheduling and token lifecycle; do not introduce parallel adapters.
- OpenTelemetry: evaluate on the existing HTTP/queue metrics and tracing
  roadmap only after operational gaps are measured. Do not replace
  existing Prometheus metrics or add duplicate instrumentation.
- Prefer existing Zod, TanStack Query, Prisma, React Hook Form, Zustand,
  Vitest, Dependency Cruiser and i18n tools over a second solution.
  Separate any proposed dependency replacement from this migration.
