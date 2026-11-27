# Notification operations — N16a

Related: [#579](https://github.com/sauron9521/gym-platform/issues/579),
[delivery policy](../architecture/notification-delivery.md),
[production observability](production-observability.md).

This slice adds read-only telemetry and an incident procedure. It does not
authorize deployment, SMTP activation, retention deletes or manual replay.
Keep both notification worker flags off until the applicable rollout gates
have been approved. Existing authentication mail is independent.

## Scrape boundary

Reuse `GET /internal/metrics` with `HTTP_METRICS_ENABLED=true` and a
separately provisioned high-entropy `HTTP_METRICS_TOKEN` in an Authorization
Bearer header. Keep the path blocked on public reverse proxies. Scrape only
over a trusted private path; do not put the token in a URL, logs, frontend
configuration or repository. A regular user or Admin session is not a
scrape credential. Disabled or invalid-token requests return 404 before
any queue query. The endpoint is excluded from OpenAPI and responses
are no-store.

Authorized scrapes share a 30-second per-process snapshot cache (including
failures) and one in-flight read. A single numeric aggregate query uses
database time and bounded counts (10,001 means at least 10,001).
Read-only transaction, 500 ms configured transaction acquisition budget,
1.5 s PostgreSQL statement timeout, 2.5 s transaction budget. These limits
bound database work, not every possible network or driver stall.
On read failure, emit snapshot success 0 and omit queue gauges rather than
report false zeros or stale success. HTTP and process counters remain
available. No arbitrary labels, addresses, destination keys, payloads,
tokens, raw errors or business identifiers are exported.

## Metric interpretation and initial alerts

All notification series below have prefix `gym_api_notification_`.
Configure a 30-second scrape interval with a timeout above the bounded
database transaction budget. Validate actual scrape cost, pool saturation
and representative production-scale query plans before activation.

| Metric suffix                  | Meaning                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| queue_snapshot_success         | 1 for successful snapshot, 0 for failure                               |
| queue_rows                     | Stored rows by fixed queue and state; capped, not lifetime totals      |
| due_rows                       | Pending rows with available-at at or before DB time                    |
| oldest_due_seconds             | Age of oldest currently due pending row; zero if none                  |
| expired_leases                 | Expired processing/claimed/sending leases (null outbox lease included) |
| expired_pending_deliveries     | Pending delivery TTL expired, even if next attempt is in the future    |
| worker_enabled                 | Effective outbox/email feature flags, not worker health                |
| outbox_results_total           | Process-local recorded outcome counters                                |
| email_results_total            | Process-local recorded outcome counters; acceptance is not delivery    |
| worker_batch_failures_total    | Process-local interrupted batch count                                  |
| email_attempt_duration_seconds | Process-local adapter latency histogram; excludes queue time           |

Queue gauges cover the shared database. Do not sum them across API
replicas. Compare or deduplicate by database/cluster using max for queue
depths and age; verify target identity and use per-target snapshot success.
Process counters and histogram buckets reset on restart; use
`rate()` or `increase()`, aggregating across distinct worker instances
only when appropriate. An SMTP attempt that returns but fails completion
may appear in latency without a recorded terminal outcome.
The delivery gauges cover all transport rows, including reserved Mobile
Push states; only email is currently wired. Invalid-token and native
schedule metrics require #342/#343.

Initial warning rules in `ops/monitoring/alerts.rules.yml`:

| Condition             | Threshold                                                |
| --------------------- | -------------------------------------------------------- |
| Snapshot read failed  | 2 minutes                                                |
| Outbox backlog        | Due age > 5 minutes for 5 minutes, enabled worker        |
| Delivery backlog      | Due age > 10 minutes for 5 minutes, enabled email worker |
| Expired leases        | Nonzero for 2 minutes, enabled worker                    |
| Dead letter / UNKNOWN | Nonzero for 2 minutes, including paused workers          |
| Worker batch failure  | Any observed increase over 5 minutes                     |

These are provisional operator thresholds, not SLOs. An intentionally
paused worker does not fire backlog or expired-lease alerts. Dead-letter
and UNKNOWN alerts remain until the issue is resolved; acknowledge or
silence an investigated incident using existing alert controls, not data
deletion. Monitor scrape-target `up` separately; absence of optional
series does not fire these rules. Quiet-hours deferrals are not due before
their next scheduled availability. Do not interpret provider acceptance
as receipt, reading or guaranteed exactly-once delivery.

## Incident procedure

1. Identify the affected deployment and check scrape health, queue gauges,
   worker flags, DB readiness, pool capacity and recent aggregate worker
   outcomes. Verify configuration through a secret-safe operator path.
2. If the queue is growing or an unsafe recipient issue is suspected, stop
   new claims by disabling the relevant worker flag through the reviewed
   deployment process. Never stop canonical Auth mail to pause optional
   delivery. Already-admitted SMTP attempts cannot be recalled.
3. Use a restricted read-only database session on the intended database.
   Do not provide scrape credentials with database access. Inspect bounded
   state/timestamp/attempt projections below. IDs are internal incident
   correlation keys, not metric labels or public support-ticket content.
4. For an expired pre-send lease, allow normal lease recovery after the
   underlying fault is repaired. Expired SENDING becomes UNKNOWN; never
   reset it to PENDING. A failed completion may represent an accepted SMTP
   message.
5. Review terminal cases with the owner. Reconcile UNKNOWN against trusted
   provider evidence if available. Preserve evidence and document the
   decision; do not automatically resend or invoke a domain write.
   Re-enable only after the cause is addressed and the owner approves.

Read-only investigation example (operator session, never a public API):

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '1500ms';
SELECT id, status, attempt_count, available_at, lease_until, last_attempt_at
FROM outbox_events
WHERE status = 'DEAD_LETTER'
LIMIT 100;
SELECT id, status, attempt_count, available_at, lease_until, finished_at
FROM notification_deliveries
WHERE status IN ('DEAD_LETTER', 'UNKNOWN')
LIMIT 100;
ROLLBACK;
```

Use a narrowly scoped SELECT-only operator role for these tables and
columns, not the application writer role. Provisioning that role and
testing live permission boundaries belong to deployment acceptance.
Do not run SELECT *, export raw provider errors, inspect unrelated user
tables, or share event payloads. No automatic/manual reset SQL or retry API
is provided here. Any future operator action must authenticate and authorize
the operator, revalidate the original committed source, enforce a fresh
fence, preserve deduplication, and never call a business mutation. Never
reset SENT, SENDING or UNKNOWN to PENDING. A safe reviewed reconciliation
workflow is a separate scope.

## Retention — default off, owner/legal review required

N16b implements a bounded scheduled job for the proposed 90-day ordinary
Inbox and 30-day technical Email horizons. These are **not approved
production deletion horizons**. Deployment configuration defaults to
`NOTIFICATION_RETENTION_MODE=off`; do not enable apply just because this
PR is merged.

| Mode      | Effect                                                                      |
| --------- | --------------------------------------------------------------------------- |
| `off`     | No retention queries or deletes (default)                                   |
| `preview` | Read-only, bounded eligible counts; no locks on candidate rows or mutations |
| `apply`   | Deletes eligible rows and records no-replay markers atomically              |

Every 15 minutes, an enabled tick considers at most 50 Inbox rows and
50 Email deliveries. Counts are per batch, not complete backlog totals.
Preview may differ from apply because apply skips locked rows. Apply
uses one transaction-scoped advisory lock (1197030721, 579), row locks
with SKIP LOCKED, a fresh eligibility read after locking and a bounded
transaction (500 ms acquisition/lock timeout, 2 s statement timeout,
10 s transaction budget). A failure rolls back the entire batch.
Logs report aggregate counts and a fixed failure code; no IDs or payloads.
There is no public cleanup/replay API or operator write endpoint.

### Conservative hold policy

- Inbox: only read USER notices from an exact successfully processed,
  single-recipient v1 event and its matching terminal trainer relationship
  or program assignment. Event, processing, creation **and read** dates
  must be at least 90 days old. Active invitations/assignments, unread or
  recently read notices, ADMIN/ACCOUNT notices, unfamiliar event types,
  conflicting sources and any notice with a delivery are preserved.
- Transport: only expired SENT/CANCELLED optional Email deliveries for a
  matching processed trainer-review event, with creation and finish dates
  at least 30 days old. Preserve the account Inbox and source review.
  No deletion of PENDING/CLAIMED/SENDING/DEAD_LETTER/UNKNOWN, future TTLs,
  revoked or mismatched review sources, or Mobile Push.
- No outbox deletion, no protected billing/security/audit or other domain
  table writes. Do not use this job as a user-erasure or legal-hold system.
  For an incident or legal hold outside these exclusions, keep apply off
  globally until its scope has been reviewed. Per-record legal hold and
  independent audit retention remain separate decisions.

### Durable deduplication and rollout

The additive migration introduces nullable `inbox_retired_at` and
`email_retired_at` on the original OutboxEvent and three candidate-search
indexes. Original unique event keys and immutable event data remain.
Inbox deletion and its marker, or Email history deletion and its marker,
commit together. An Inbox replay skips a retired event; Email planning
locks the original event before checking the email marker, including
direct repository calls. No business mutation is re-executed. Future
transport planners must use the same event-row fence and respect the
retirement markers before adding any delivery. Do not delete or reset
these markers to resolve an incident.

1. Review the proposal and legal/operational hold requirements. Confirm
   expected retention and backups with the owner; keep mode off otherwise.
2. Rehearse the forward-only migration in isolated staging with realistic
   row counts and query plans. Index builds can block writes; schedule
   the deployment appropriately. Validate backup/restore and recovery
   evidence, including preserved event markers.
3. Deploy the marker-aware version to **all** workers before enabling
   preview/apply. Inspect aggregate preview counts and sampled eligibility
   using approved read-only tools. No production apply until explicit GO.
4. After apply, an older binary that ignores markers must not process
   notification outbox or Email work. If rollback is necessary, pause
   both worker flags and retention; use a marker-aware rollback build or
   forward fix. Restoring an older backup can lose markers and delivery
   state; keep workers paused until reconciliation. No automatic restore
   or replay guarantees.

## Verification and rollout

The metrics registry and cache have unit tests; real PostgreSQL tests
cover committed states, future availability, expired leases, TTL and
saturated counts. HTTP tests cover the existing scrape authorization.
Promtool evaluates the alert simulations offline. Retention integration
tests cover read-only preview, eligible cleanup, preserved source and
security evidence, replay, concurrent claims, SQL rollback and batch caps.
These tests are not evidence of live alerts, multi-process crash recovery,
sustained worker load, production-safe deletion or mobile delivery. Validate on isolated
staging with representative queue volume and separate worker replicas,
test the alert receiver and incident procedure, and record owner approval.
