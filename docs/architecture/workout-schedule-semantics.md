# Workout schedule presentation semantics (#341)

Scheduled and completed timestamps remain absolute UTC/offset instants
on the wire and PostgreSQL timestamptz in storage. A calendar displays
them using the existing device-local civil calendar; Web and Mobile
use the same pure `@gym/domain` classification, never a fixed 24-hour
window. Calendar day bounds remain inclusive up to the final millisecond
before the next local day/month. No persisted status is added.

| Canonical state                        | Calendar display |
| -------------------------------------- | ---------------- |
| PLANNED on or before the scheduled day | Planned          |
| PLANNED after the scheduled day        | Missed           |
| IN_PROGRESS                            | In progress      |
| COMPLETED on or before scheduled day   | Completed        |
| COMPLETED on a later civil day         | Completed late   |
| CANCELLED                              | Cancelled        |

The day boundary, not the exact planned minute, is the proposed product
meaning of missed/late for this calendar slice. A workout can still be
started after its scheduled date. Unscheduled, malformed or incomplete
timestamp evidence does not invent a status. No automatic status mutation,
notification, or change to API filtering, counts, training progress or
domain transition rules is triggered by time passing.

Both calendars refresh the display clock in the foreground at most every
minute and after visibility/resume. Device timezone differences can
produce different local calendar dates across devices; this preserves
the existing calendar behavior rather than silently changing scheduling
semantics. The account IANA timezone for quiet hours remains a separate
policy from the device display zone. Travel/timezone-change reconciliation
and native OS scheduling require #342/#343 device verification.

A reminder must be planned from the absolute scheduled instant minus its
explicit elapsed-time lead (15/60/1440 minutes), not from a derived display
status or an ambiguous wall-clock string. Quiet hours use the verified
account IANA timezone and the real reminder instant, including both
occurrences of an autumn repeated hour. Do not infer missing/invalid
account timezone. #342 owns actual scheduling, contextual permission,
cancellation and stale reconciliation; this slice performs no OS work.

Tests cover local midnight, leap/date validation, Kyiv DST spring/fall
instants, UTC offset, date line, canonical state preservation, and both
calendar clients. Actual device/calendar QA remains #348/#349.
