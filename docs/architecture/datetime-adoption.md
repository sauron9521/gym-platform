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

| Area                                                            | Decision                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Domain workout calendar status (#341)                           | Adopt strict parse and civil day via shared datetime; keep business rule               |
| Web and Mobile calendar-month helpers                           | Next slice: shared month/week arithmetic and DST boundaries                            |
| API notification settings and delivery policy                   | Separate slice: named-zone and quiet-hour classification, preserve fail-closed consent |
| Mobile reminders (#342)                                         | Absolute elapsed-time lead; permission and device evidence before scheduling           |
| Progress, body measurement statistics, Trainer dashboard        | Review interval semantics and query boundaries before migration                        |
| Admin and dashboard formatting                                  | Review existing locale formatting; keep Intl/next-intl when sufficient                 |
| Auth session TTL, database lease/retention, monotonic deadlines | Keep existing clocks and absolute/SQL arithmetic; no cosmetic replacement              |

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

## Other library candidates — not approved

- Expo Notifications: existing #342/#343 owns native permission,
  scheduling and token lifecycle; do not introduce parallel adapters.
- OpenTelemetry: evaluate on the existing HTTP/queue metrics and tracing
  roadmap only after operational gaps are measured. Do not replace
  existing Prometheus metrics or add duplicate instrumentation.
- Prefer existing Zod, TanStack Query, Prisma, React Hook Form, Zustand,
  Vitest, Dependency Cruiser and i18n tools over a second solution.
  Separate any proposed dependency replacement from this migration.
