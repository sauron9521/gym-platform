# Notifications — delivery, scheduling, failure and security policy

- **Status:** Accepted target policy; PostgreSQL in-app dispatch and external delivery state and gated optional SMTP email implemented; Mobile transports pending
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

The existing MFA publisher, five relationship transitions (#570) and four assignment transitions (#571) are supported sources. For MFA, re-parse the
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
by authorized operators. N16a (#579) adds bounded queue depth/age gauges, alerts and a read-only
incident procedure. Safe operator replay and retention cleanup remain gated. The test suite exercises independent
PostgreSQL connections, simulated expired leases, stale writes, injected
transaction rollback, bounded attempts, revocation and replay. Actual
separate-process crash/restart and staging activation remain unverified.

## N06b: external delivery state foundation (#569)

The additive `notification_deliveries` table is independent of outbox
processing. Each row is unique by notification, server channel and opaque
destination key; deletion of the notification cascades to its deliveries.
The email destination is the constant `account-email`, never an email
address. Mobile Push reserves opaque device UUID destinations; device
registration, permission and token checks are not implemented here.
Database checks constrain destination keys, attempts, leases and terminal
timestamps. No backfill is performed. The N15 optional email scheduler is described below.

The private repository currently supports planning optional email only
for the documented `trainer.application.reviewed` ACCOUNT/USER event.
The #572 applicant review producer and Inbox projection are implemented. N15 wires the planner into the outbox transaction behind the email feature flag. Planning
and admission re-read the current active, verified account, the owned
approved/rejected application, notification expiration, current opt-in
with a valid consent timestamp and timezone/settings. Consent must predate
or equal the committed review time (not delayed Inbox creation); admission also matches the
original consent epoch. Auth security-change mail stays in the existing
Auth flow; it is not an optional-email candidate. Unknown types, revoked
sources, foreign or inactive accounts and invalid settings fail closed.

State transitions:

- PENDING -> CLAIMED: one atomic PostgreSQL claim with a new UUID fence,
  using SKIP LOCKED and a 30-second database-clock lease.
- CLAIMED -> SENDING: re-check eligibility immediately before admission;
  increment send attempts only on admission. Quiet hours defer with a
  15-minute recheck (never beyond expiry); ineligibility cancels.
- Expired CLAIMED leases may be reclaimed with a different token.
- SENDING -> SENT means provider acceptance, not guaranteed delivery.
  Definite non-send failures may retry with bounded jittered backoff
  (five total attempts); definite permanent failures dead-letter.
- SENDING -> UNKNOWN on ambiguous outcome or abandoned sending lease.
  UNKNOWN never auto-retries. A stale token cannot finalize a newer claim.
- Expired pending deliveries cancel. The provisional lifetime is at most
  24 hours from committed review, bounded by Inbox expiry.
  The optional email channel retains this provisional lifetime; review during #579.

The repository returns a durable admission marker and the freshly verified
destination in memory, not a provider call or a guarantee that consent
cannot change after commit. No address, provider response or free-form
error is persisted. Error codes are fixed.

Integration tests use actual PostgreSQL and two independent clients,
with simulated lease expiration and provider outcomes. They prove
destination uniqueness, fencing, consent/source checks, quiet deferral,
expiry, bounded retries, UNKNOWN behavior and cascade deletion.
Separate-process crash/restart, live staging and Push/device authorization
remain unverified. #569 remains open; native channel work belongs to #343
and operations/reconciliation to #579.

## N15: optional transactional email (#578)

The only optional email event is `trainer.application.reviewed`. Planning
is atomic with the authorized Inbox insert and outbox completion. The
existing unique delivery key prevents duplicate logical sends on replay.
There is no scan or backfill of previously processed Inbox records.
The domain review transaction and the canonical verification/recovery
mailers remain independent of SMTP delivery and optional preferences.

Both `NOTIFICATION_DISPATCH_ENABLED=true` and
`NOTIFICATION_EMAIL_ENABLED=true` plus configured `SMTP_URL` are required.
Both flags default to false; production retains the existing SMTPS and
sender requirements. Optional email never uses the log transport.
Do not enable staging or production delivery until owner approval and
operational readiness (#579). Disabling the flag stops new claims and
planning; existing records are re-evaluated on any later admission.

A separate Nest cron tick (15 seconds, no overlap in one process) claims
at most five deliveries sequentially via the existing PostgreSQL leases.
Admission rechecks ownership, active/verified account, authoritative
review, current consent epoch, timezone/quiet hours and expiration.
The verified address and current locale (en, otherwise uk) are returned
only in memory. SMTP I/O happens outside the transaction. A conservative
20-second attempt budget includes admission time and is capped by
remaining TTL, within the 30-second send lease. The mailer receives an
abort signal, a stable delivery idempotency key and explicit
`retry: false`; retries belong only to the durable delivery state machine.
A definite negative SMTP reply may retry (4xx) or dead-letter (5xx).
Known pre-connection failures can retry; ambiguous timeouts, disconnects
and lost DATA acknowledgements become UNKNOWN, never automatic retries.
On process/DB failure, an abandoned SENDING lease becomes UNKNOWN.
A stable Message-ID is not a guarantee of physical exactly-once delivery.

Templates contain only generic account-update copy, fixed subject,
and the configured app origin's protected `/notifications` link. No
business outcome, reviewer, application ID, note, token or user-provided
HTML is included; the existing file template engine escapes link values.
Authentication and current Inbox authorization remain required.
Recipient addresses and SMTP replies are not stored in delivery rows
or written to worker logs; batch logs contain only aggregate outcomes
and a fixed failure code. Do not attach unredacted mail diagnostics.

**Residual race:** consent, recipient email or account state can change
after the admission transaction commits and before SMTP accepts. The
worker starts immediately using the verified snapshot, with a bounded
deadline, and rechecks before every retry. A message already admitted
cannot be recalled; generic content minimizes disclosure. No database
lock is held over network I/O. Staging SMTP, provider reconciliation,
multi-process crash testing and operational acceptance remain open.

CI uses a loopback SMTP peer with the actual mail transport and PostgreSQL
to verify success, temporary/permanent refusals, lost DATA replies,
deduplication, revoked consent and quiet hours. Local Mailpit smoke
complements these checks; do not send to real user addresses during tests.

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

## N16a: notification operational telemetry (#579)

The existing protected internal metrics endpoint includes a cached,
bounded, read-only PostgreSQL queue snapshot, fixed-label process worker
counters and optional SMTP adapter latency. Collection failure is explicit
and omits stale queue gauges. Offline Prometheus rules cover backlog,
expired leases, collection failure and unresolved terminal outcomes.
See [notification operations](../operations/notifications.md) for thresholds,
incident procedure, privacy and activation gates. Retention defaults remain
a proposal; no data deletion, replay endpoint or operator mutation is
introduced in N16a. N16b adds the default-off implementation below.

## N16b: bounded notification retention (#579)

The default-off retention job implements read-only preview and explicit
apply with proposed 90/30-day horizons, capped at 50 records per kind
every 15 minutes. Only terminal, read, matching single-recipient ordinary
Inbox events and old expired SENT/CANCELLED optional Email records are
eligible. Preserve every OutboxEvent and immutable unique key; atomically
mark Inbox or Email retirement with the corresponding delete. Dispatch
and Email planning honor these markers using the same event-row lock.
No security, financial or other business/audit evidence is pruned. The
[operations runbook](../operations/notifications.md) specifies the
conservative exclusions, rollout/rollback gates and remaining legal
review. Do not enable apply until all workers honor the markers.

## N14a — local reminder planning foundation (#342)

The shared domain owns the pure quiet-hour and future reminder candidate
policy. API still validates persisted settings and category-specific consent;
Mobile uses the existing strict settings response contract and a pure,
owner-scoped planner. Only a complete, fresh scheduled-workout snapshot
with explicit OS grant and confirmed WORKOUT/LOCAL_REMINDER consent can
produce a plan. Foreign owners, duplicates, invalid timestamps, oversized
or incomplete snapshots block the entire plan. A ready plan with no
candidates is distinct from blocked evidence. The plan contains only
internal workout IDs and UTC due timestamps, not OS notification content.
Quiet or expired candidates are skipped, not deferred; 1440 minutes is
elapsed time, independent of DST.

The proposed preparation limit is 32 earliest candidates per installation
from at most 1000 scheduled records. The native lifecycle must establish
a bounded fresh query horizon, account/session generation fencing, total
pending OS capacity and cancellation/reconciliation before enabling this
limit or scheduling anything. Blocked results cannot be interpreted as
permission to retain stale pending reminders. The planner is not wired
to a background task or UI. Expo SDK 58.0.26's bundled module manifest
specifies expo-notifications ~58.1.9; dependency installation, actual native
permission reader, contextual prompt and OS scheduler are separate slices.
No permission, token, native identifier or persistent schedule is created.
Keep #342 open until Android/iOS device acceptance (#348/#349), including
offline revocation limitations, logout/switch, edit, resume and timezone
changes. Push remains gated on local scheduling evidence.
