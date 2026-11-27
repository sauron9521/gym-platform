# Notifications — delivery, scheduling, failure and security policy

- **Status:** Accepted target policy; PostgreSQL in-app dispatch foundation implemented, external delivery pending
- **Parent:** [#563](https://github.com/sauron9521/gym-platform/issues/563)
- **Related:** [architecture](notifications.md) · [events](notification-events.md) · [Mobile push safety design](../../apps/mobile/docs/push-notification-design.md)

## Delivery lifecycle

1. Producer writes business state and one unique, versioned `OutboxEvent` within a PostgreSQL transaction; rollback removes both.
2. Dispatcher atomically **claims** a bounded available batch using a lease and a concurrency-safe SQL/Prisma approach (e.g. PostgreSQL `FOR UPDATE SKIP LOCKED`). On restart, expired leases may be reclaimed.
3. Validate schema version and event type, re-fetch current aggregate, account/capability and recipient policy. Create one logical Inbox notification per authorized (`eventId`, `recipientId`, `scope`). Missing/invalid recipient or event must fail closed and be observable.
4. Evaluate notification preferences **per category/channel** and per-device registration/permission state. Inbox rows are available immediately; a user turning off external channels does not delete already legitimately recorded Inbox entries.
5. Schedule permitted external deliveries separately by channel, with an idempotency key per notification+channel+destination. Before every send, re-check account status, current authorization, cancellation, consent and quiet-time validity.
6. Record attempts/provider acknowledgement (not guaranteed device display), bounded retry/backoff and terminal/dead-letter results. Logs and metrics contain only redacted errors, event IDs and counts.
7. Clicking a notification opens an authenticated, authorized resource read. Mark-as-read does **not** acknowledge the business action or payment/approval.

Outbox processing, Inbox persistence, and each channel's attempts are **separate state machines**; never mark an entire domain event failed merely because a user's OS notification was denied.

## N06a: in-app dispatcher (#569)

The API scheduler polls every 15 seconds, only when the validated
`NOTIFICATION_DISPATCH_ENABLED=true` setting is explicitly configured.
The default is false in all environments. Do not enable production
polling until the owner approves the deployment and operational checks.

A tick handles at most 10 claims, sequentially, using the existing Prisma
pool. Each claim is one atomic PostgreSQL UPDATE with a candidate selected
using FOR UPDATE SKIP LOCKED. The database clock determines availability
and the 30-second lease. The incremented attempt number and lease expiry
fence late workers. Processing locks the claimed row and commits the
Inbox insert and outbox completion in the same bounded transaction.
A worker that stops after claiming leaves an expired lease recoverable
by another instance. No external I/O is performed while holding a lock.

The existing MFA publisher is the only supported source. Re-parse the
strict v1 contract, match its deterministic event key and re-read the
immutable MFA lifecycle audit (ID, account, action, occurrence time).
Check active/non-deleted account under a user-row lock before inserting
a generic ACCOUNT/USER notification. External preferences do not suppress
in-app delivery. Unknown schema, malformed events, source mismatch or
conflicting existing Inbox data dead-letter immediately. Ineligible
recipients complete without an Inbox row and retain a safe skip code.
Replay preserves the existing read timestamp and never repeats a source
mutation. Transient processing failures retry up to five total attempts,
with equal-jitter exponential delays (5-second initial ceiling, capped
at 60 seconds); abandoned final claims also dead-letter. A failed retry
write leaves the lease recoverable. On shutdown, the current claim may
finish; no new claim starts after the shutdown hook.

Structured batch logs expose only processed/skipped/dead-letter/retry/
lease-lost counts and a generic batch failure code. Existing persisted
outbox status, attempt counts and redacted error codes are inspectable
by authorized operators. Queue depth/age gauges, alerts, safe operator
replay and retention remain #579. The test suite exercises independent
PostgreSQL connections, simulated expired leases, stale writes, injected
transaction rollback, bounded attempts, revocation and replay. Actual
separate-process crash/restart and staging activation remain unverified.

The external `NotificationDelivery` model, destination idempotency,
channel-specific leases/consent checks and adapters are explicitly
deferred to a second #569 slice and channel work (#343/#578). No external
sends, ADMIN scope fanout, automatic replay endpoint, new migration or
queue service are added here. #569 remains open until its remaining
acceptance criteria are verified.

## Channel policy and quiet hours

Quiet hours default to **22:00–08:00** in the user's authoritative IANA timezone, can be disabled or changed. Existing `Profile.timezone` is the initial source of truth (see [#297](https://github.com/sauron9521/gym-platform/issues/297)); do not add another competing timezone field. Store absolute due instants in UTC and validate IANA identifiers. The quiet window may wrap midnight. Use timezone library calculations and explicit DST tests: skipped and repeated local wall-clock times must not produce double or silently shifted reminder sends.

| Channel/event                                         | Quiet window behavior                                                                                                                      | Eligibility                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| In-App                                                | Persist/visible immediately, no deferral                                                                                                   | Authenticated and authorized owner; ADMIN scope separately guarded                          |
| Normal Mobile Push                                    | Defer to the next allowed instant; re-evaluate age/relevance                                                                               | Explicit per-category opt-in, native permission, verified device token and eligible account |
| Mobile Local Workout Reminder                         | Schedule using selected 15/60/1440 minute lead; **skip** an event that would become irrelevant during quiet hours rather than send it late | User opt-in + OS permission + PLANNED workout and valid future time                         |
| Optional transactional Email                          | Defer if nonurgent; only channel/category opt-in                                                                                           | Current address, consent and allowed event                                                  |
| Account recovery/verification/security-critical email | **Do not delay** time-sensitive security action                                                                                            | Existing canonical auth mail flow; rate limits and abuse guards apply                       |
| Admin/Owner approval event                            | Create protected Inbox now; optional external signal follows current permissions and quiet hours                                           | Current server-side permission; notification is never itself an approval                    |
| Marketing                                             | No sends at MVP                                                                                                                            | Future _separate_ explicit marketing consent                                                |

If timezone or scheduled workout changes, regenerate future reminders from server truth; cancel old native scheduled IDs and reconcile after app resume. If the app remains offline or OS denies permission, best effort only; do not claim a guarantee of delivery. A completed/cancelled workout is never reminded as still planned.

### Local-vs-remote reminder deduplication

On an eligible Mobile installation, the chosen workout reminder should have **one owner** (local scheduling preferred for offline resilience). An eventual remote push for the _same_ workout + lead time + installation must be suppressed when a local reminder is scheduled; the platform needs device-scoped schedule identity/reconciliation rather than assuming that a user-level preference proves actual OS scheduling. If the server cannot determine safe ownership, do **not** blindly double-send a remote reminder. Delivery attempts for a program assignment (a different event type) are not workout reminder duplicates. Device-level behavior is implemented and verified by [#342](https://github.com/sauron9521/gym-platform/issues/342) / [#343](https://github.com/sauron9521/gym-platform/issues/343).

## Mobile push and device lifecycle

- Current `apps/mobile/src/features/notifications/lib/notification-policy.ts` is a **pure validation/eligibility policy**; do not mistake it for native registration.
- User must explicitly opt in **and** grant the OS permission; backend independently checks signed-in user, verified email where required, consent, device ownership and token validity.
- Register/revoke/rotate tokens only in authenticated flows; invalidate on logout, account switch, preference revocation, account deletion, app reinstall/token invalidation. Encrypt or otherwise protect stored tokens, restrict reads, never expose in API list/logs.
- Cross-OS transport must carry only **`{ "notificationId": "<UUID>" }`** as data; OS-visible title/body must remain generic (no account name, workout/program details, medical/financial data). Native app then GETs details with current account authorization. Invalid/unexpected keys reject, do not interpret URL or private text.
- Provision EAS / APNs / FCM credentials outside repository; do not test against live users. Staging Android/iOS device evidence and [#348](https://github.com/sauron9521/gym-platform/issues/348) / [#349](https://github.com/sauron9521/gym-platform/issues/349) gates are required for declaring push/local reminders complete.

## Reliability, security and operations

- **Idempotency:** unique event business key, unique logical Inbox recipient row and unique channel/device attempt key. No promise of exactly-once SMTP/FCM/APNs display when acknowledgment is lost.
- **Retries:** finite attempts, exponential backoff with jitter, provider rate limits, TTL/expiry checks, dead-letter for terminal errors; do not spin on permanent 4xx or revoked permissions. Uncertain results require deliberate provider reconciliation where possible, not blind repeated external sends.
- **Concurrency:** lease/lock under multiple API instances or worker replicas; re-check eligibility on each attempt, never rely on cached role/permission indefinitely.
- **Data hygiene:** no secrets/tokens/PII in logs or event envelopes. Retention _proposal_, not enacted policy: ordinary Inbox ~90 days, transport technical records ~30 days; legal/security billing audit retention is separately controlled and must not inherit these defaults.
- **Abuse/DoS:** paginate/cap read endpoints, rate-limit account/device registration and mutation operations, limit active devices and queue batch/connection counts, do not expose arbitrary recipient fanout to clients.
- **Admin security:** ordinary `ADMIN` is not automatically Super Admin. Current verified permission checks apply to Inbox detail and all destination resources, and are invalidated on privilege loss. Approval state derives only from the owning workflow [#542](https://github.com/sauron9521/gym-platform/issues/542).
- **Observability:** queue backlog age/size, claim lease expiry, delivery latency/error class, dead letters, revoked token count, stale reminder suppression; alerts with no private payloads. Operator replay is a notification processing action, never re-executes money/approval writes.

## Polling and optional SSE

**MVP:** TanStack Query fetches paginated Inbox and count, with unread polling every **30–60 seconds only when authenticated and page/app foreground/visible**; refetch on window focus, mobile resume, and successful mutation. Clear cross-account caches on logout/account switch. Polling never means continuous mobile background work.

**Deferred [#580](https://github.com/sauron9521/gym-platform/issues/580):** add SSE to Web, Trainer, Admin only when the team measures a real latency/load need. Emit an opaque `notifications.changed` event; on event clients invalidate query cache and use the _existing_ authenticated GET endpoints. SSE needs session auth, server-side permission checks and revocation handling, no sensitive text in stream, connection caps, heartbeats, reconnect/backoff, proxy compatibility and initial/recovery GET. SSE does not replace Mobile Push and must not be kept open indefinitely in Mobile background.

## Verification / rollout gates

| Stage                | Required proof                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| #565 preferences     | Zod strict/defaults, user ownership, cross-midnight and DST, consent revocation, timezone test                                                  |
| #566–569 persistence | Real PostgreSQL rollback, two concurrent workers, replay/restart, dedup, dead-letter/retry, no payment/business mutation                        |
| #570–572 events      | Actual committed domain change only, wrong recipient/IDOR negative tests, role revoked mid-flight, correlation                                  |
| #573–577 clients     | Focus/resume/visibility, multi-account cache isolation, i18n uk/en, accessible empty/error/read states                                          |
| #342/#343 native     | Actual development/preview build on Android/iOS, permission deny/allow, logout, token rotation, offline/reschedule/DST and duplicate prevention |
| #543/#557 admin      | Super Admin/current permission checks, approved/pending/unread distinction, no action implied by notification, cross-domain tests               |
| #579 operations      | Metrics/alerts redaction, safe operator replay, retention tests and documented incident drill                                                   |

No claims of production readiness until the **specific** channel and device tests have been run and recorded. This ADR records the policy and implementation boundaries.
