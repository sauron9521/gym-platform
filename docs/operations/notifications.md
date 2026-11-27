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

## Retention proposal — owner/legal review required

Proposed targets from #579: ordinary Inbox 90 days and technical transport
history 30 days. These are not approved deletion horizons. The current
unique outbox event key and delivery key are deduplication evidence;
deleting terminal rows can allow replay to create new deliveries.
Deleting Inbox rows cascades delivery rows. A 30-day transport deletion
cannot safely proceed until logical delivery tombstones or an equivalent
durable no-resend mechanism are designed and tested. Do not prune outbox
keys based only on age.

A later N16b should implement a bounded preview and approved, default-off
cleanup with an explicit hold policy, terminal-state/lease exclusion,
transactional fencing, preservation of deduplication evidence, and
integration tests proving protected business and audit records survive.
Exclude security/privileged notices, UNKNOWN/dead-letter evidence, active
deliveries, billing records and security audit logs until their owners
approve separate lifecycle policies. Keep audit retention independent of
Inbox retention. No scheduled deletion or retention schema change is
implemented in N16a. Confirm product/legal requirements and backup/restore
implications before enabling cleanup.

## Verification and rollout

The metrics registry and cache have unit tests; real PostgreSQL tests
cover committed states, future availability, expired leases, TTL and
saturated counts. HTTP tests cover the existing scrape authorization.
Promtool evaluates the alert simulations offline. These tests are not
evidence of live alerts, multi-process crash recovery, sustained worker
load, production-safe deletion or mobile delivery. Validate on isolated
staging with representative queue volume and separate worker replicas,
test the alert receiver and incident procedure, and record owner approval.
