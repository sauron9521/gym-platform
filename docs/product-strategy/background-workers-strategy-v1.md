# OVRANTO — Background Workers Strategy v1.0

- **Decision:** OWNER APPROVED, BW01–BW10 (120 decisions), 2026-11-28.
- **Publication:** manual owner merge and main verification required.
- **Scope:** background processing in the existing NestJS modular monolith and PostgreSQL.
- **Related:** [ADR-008](../architecture/notifications.md), [ADR-010](../architecture/adr-010-segregated-api-interfaces.md), [Shared Packages](shared-packages-strategy-v1.md), [Release & Feature Management](release-feature-management-v1.md), [S05](s05-security-trust-v1.md), [S06](s06-production-reliability-v1.md), [#380](https://github.com/sauron9521/gym-platform/issues/380), [#588](https://github.com/sauron9521/gym-platform/issues/588), [#353](https://github.com/sauron9521/gym-platform/issues/353).
- **Limit:** strategy approval only. No runtime change, dependency installation, infrastructure purchase, activation, issue closure, Beta or production GO.

## BW01 — Background Processing Architecture

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235813168).

Retain the modular NestJS monolith, PostgreSQL-first reliable processing and existing Transactional Outbox. Authoritative business writes, authorization and invariants remain synchronous within their domain transaction; asynchronous acceptance is not completion. Separate event-driven, scheduled and on-demand work. Keep business handlers in their owning modules. Incrementally evaluate a dedicated NestJS worker process and independent API/worker scaling after ABI08 and the separate final Backend Core decision. Distinguish outbox events, channel delivery and future long-running job state; introduce a separate job model only with demonstrated need. BullMQ is evidence-gated, not mandatory. No premature @gym/worker, universal job framework or microservices. Reuse existing issues and rollout gates, including #568/#569/#579 and #922/#923.

## BW02 — PostgreSQL Transactional Outbox

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235906573).

Retain OutboxEvent and its transaction-local publisher: insert with the same business transaction, propagate failure, preserve immutable data and reject conflicting keys. Deterministic event keys identify logical transitions, including legitimate distinct revisions; a schema upgrade alone must not create a second logical event. Preserve existing event names and adopt fact-oriented domain event taxonomy without mass renaming. Use strict versioned Zod contracts and minimal routing IDs/context, no sensitive snapshots, credentials, addresses or payment/health details. Re-read authoritative state and current eligibility/authorization. Deploy compatible readers before new writers; retain old-version handling until pending/retained/replay and rollback compatibility is proven. At-least-once attempts within policy, idempotent logical effects, no guarantee of successful or exactly-once external delivery; no global ordering, per-aggregate ordering only if justified.

Keep independent NotificationDelivery state and UNKNOWN handling; no external I/O under database locks. Consider per-consumer state only when a second real independent consumer exists; no new table/event bus now. Separate outbox infrastructure from domain-owned contracts after ABI08 and core decision, no forced extraction. Outbox is neither event sourcing nor audit history. Retention preserves deduplication, original event keys and no-replay markers; controlled scoped audited replay rechecks eligibility and never repeats original business writes. Real PostgreSQL rollback, concurrent replay/conflict, stale fences, mixed versions, retention and crash/multi-instance evidence are required. See [events](../architecture/notification-events.md) and [delivery](../architecture/notification-delivery.md).

## BW03 — Worker Processes & Deployment

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7236134911).

One NestJS codebase, separate API and worker entrypoints in apps/api, worker using createApplicationContext with minimal WorkerModule and no public HTTP infrastructure. Combined/API/Worker execution modes are target design, not implemented configuration. Reuse one signed immutable runtime image and role-specific commands, health probes and validated configuration; retain separate migration image and one controlled forward migration. Current HTTP image health check requires override for a non-HTTP worker. Use least privilege, role-specific secrets, no whole HTTP AppModule import, no public worker ingress. Preserve combined compatibility until controlled handover; prevent duplicate schedule activation. Independent container scaling with CPU/RAM/DB budgets including rollout overlap, advisory locks and migrations.

On SIGTERM stop new claims, allow bounded in-flight completion and persist outcomes before pool closure. Calibrate grace period against actual deadlines; SIGKILL/lease recovery uses fencing, ambiguous external sends remain UNKNOWN. Separate liveness/readiness/heartbeat/backlog/provider degradation; no restart loop solely for transient dependency failure. Internal health/metrics only. Signed staging rehearsal, adjacent-version readers/writers and migration compatibility, exact artifact and manual owner release approval; rollback only to compatible runtime, no automatic down migration. Split after ABI08 and explicit core decision with actual multi-process evidence. Keep current dispatch/email/retention modes off by default and canonical Auth mail independent.

## BW04 — Job Scheduling

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7236248075).

Retain @nestjs/schedule for static technical schedules, durable delayed work via availableAt and separate native local scheduling (#342/#343/#348/#349). No per-user in-memory durable timers. Use session advisory lock on a pinned dedicated connection for appropriate long maintenance, transaction advisory lock for short atomic maintenance, SKIP LOCKED/leases/fences for concurrent claims. waitForCompletion is process-local; a lock prevents overlap, not sequential duplicates. Use durable execution identity/checkpoints where necessary and budget lock connections. Audit avatar storage and cleanup races before multi-instance activation (#921/#923).

Each job declares SKIP, RUN_ONCE, CATCH_UP or EXPIRE behavior for missed execution, bounded batches/timeouts/catch-up and resource protection. Maintenance RUN_ONCE is a candidate requiring evidence; durable due events catch up within policy, stale reminders expire. No automatic startup replay now. Preserve existing schedules; prefer UTC for new technical schedules where appropriate; explicitly distinguish elapsed time, absolute UTC instants, database clock and IANA civil timezone/DST semantics per SP05. No silent invalid-zone or ambiguous-time fallback. Registry documents key/owner, trigger, role, timezone, duration/batch bounds, concurrency, misfire, gates, metrics and recovery. Documentation/typed configuration first, no ScheduledJob table or universal scheduler until justified. Read-only Operations Center first; run/pause/retry or arbitrary cron changes require separate scoped authorization, audit, idempotency and approval.

## BW05 — Retry, Idempotency & Dead Letter Queue

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7236420415).

Standardize error classification: transient safe-to-repeat or definite non-send, provider rate limit (bounded Retry-After), permanent invalid contract/conflict, revoked authorization, expiry, stale fence and unknown external outcome. Per-job bounded attempts, timeouts, TTL and retry budgets; exponential backoff with jitter. No nested hidden retries or blind writes. Preserve immutable event identity, Inbox uniqueness (event/recipient/scope), delivery uniqueness (notification/channel/destination) and independent claim fences; stable provider IDs do not guarantee exactly-once. Retain separate state machines:

- Outbox: PENDING, PROCESSING, PROCESSED, DEAD_LETTER.
- Delivery: PENDING, CLAIMED, SENDING, SENT, CANCELLED, DEAD_LETTER, UNKNOWN.

Definite retryable failures may return to pending within policy after eligibility checks. Invalid or exhausted work dead-letters; obsolete/unauthorized work skips or cancels. Pre-send abandoned claims can recover; abandoned SENDING or ambiguous response becomes UNKNOWN, never automatic resend. SENT denotes provider acceptance, not recipient delivery. Preserve PostgreSQL DEAD_LETTER status, no separate DLQ table. Controlled replay/reconciliation uses trusted provider evidence if available, otherwise remains uncertain; respect authorization, dedup/retention markers and audit; never re-execute paid or privileged domain writes. Read-only diagnostics first; operator mutations require separate review. Bound batches/concurrency/provider rate, retry budgets, expiry and catch-up to prevent retry storms; circuit breaker only if evidence justifies it. Real DB failure/recovery tests cover duplicates, rollback, stale fences, timeout, lost acknowledgment, exhaustion and revocation.

## BW06 — Redis & BullMQ Adoption Criteria

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7236674201).

PostgreSQL-first until measured need. Optimize existing dispatcher and diagnose provider/SQL/pool/resource bottlenecks before comparing queue engines. Measure due lag, oldest due age, sustained arrivals/completions, retry amplification, HTTP p95/p99/errors, DB CPU/pool/locks, worker resources and provider latency. Proposed p95 due lag 60 seconds or oldest due 5 minutes are investigation hypotheses, not SLOs or automatic triggers. Compare tuned PostgreSQL with candidate on equivalent workload/resource budget and complexity/maintenance/operational cost. Evaluate maintained compatible BullMQ, Nest integration and alternative backends (including PostgreSQL-backed candidates), license/security and feature parity; do not assume support. A separately approved bounded synthetic noncritical idempotent pilot must benchmark failure and recovery; no billing, AI or real delivery as first pilot.

If adopted, preserve PostgreSQL authoritative business state and atomic outbox. Relay enqueue/ack across Redis and PostgreSQL is non-atomic: durable handoff/reconciliation, stable job identity, no loss or duplicate logical effects, no dual active consumer of the same effect, idempotency independent of retained BullMQ job IDs, fences/expiry/authorization and UNKNOWN policy. Separate production security Redis from queue Redis (logical databases/prefixes do not isolate resource failures); private network, scoped ACL/TLS where required, persistence and tested recovery, noeviction with bounded memory/backpressure, distinct producer/worker connections. Redis 8 local/rehearsal and current ioredis rate limiting are not proof of production queue readiness. Separate owner GO before dependency/pilot and production rollout; no required BullMQ integration.

## BW07 — Concurrency & Resource Management

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7236798099).

Layer global, process, job-type and dependency concurrency; local limits are not distributed admission. Claim only available slots, bound in-flight and queued work, keep provider rate and concurrency limits separate; retain leases/fences/TTL/consent and no external I/O under DB locks. Prefer bounded async I/O over unbounded Promise.all. Evaluate p-limit/p-queue as process-local candidates, not durable queues. Profile event-loop delay and CPU before using node:worker_threads, isolated processes or Piscina for proven CPU-intensive work; avoid oversubscription and unbounded memory. Separate CPU/RAM and PostgreSQL budgets, account for deployment overlap and reserve. Current sizing is baseline configuration, not measured capacity or procurement approval.

Classify runtime priority to isolate critical workloads and prevent starvation; priority labels are illustrative, not new schema or SLO. Backpressure on optional job admission/processing protects authoritative HTTP/business operations and never silently discards durable events. Recover gradually with bounded catch-up. Future per-user/per-trainer fairness uses authorized identity; no new product/entitlement quotas. Static validated role limits first, adaptive concurrency only after stable evidence and separate review. Benchmark arrivals/completions, due lag, HTTP latency/errors, pool wait/locks, CPU/RSS/event loop and dependency limits. Require load, contention, slow dependency, retry amplification, resource exhaustion and shutdown recovery proof.

## BW08 — Worker Observability

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237052002).

One API/worker telemetry pipeline; retain Prometheus/Grafana and extend with a Background Workers dashboard. Standardize queue (depth/due/lag), execution (throughput/duration/active), reliability (retry/DLQ/UNKNOWN), lifecycle (heartbeat/readiness/drain/restart), resource (CPU/RAM/event-loop/pool) metrics. Distinguish queue lag, execution and end-to-end latency; acceptance is not delivery. Shared DB gauges deduplicate by cluster/DB, never sum replicas; use distinct process counter rates and compatible histogram buckets, not averaged percentiles. Capped counts are lower bounds; absent/stale/failed telemetry is UNKNOWN, never false zero. Preserve private authenticated scrape, fixed labels, bounded read-only snapshots and current alert thresholds as provisional operator baseline, not SLO. Check target availability, intentional pause, heartbeat, scrape overhead, counter reset and real independent alert routing.

Structured logging follows LF07 Pino pilot and parity before replacing the current logger; no second logging pipeline. Redact credentials, personal data, payloads and free-form errors; opaque correlation IDs only in authorized logs/traces, never unbounded metric labels. Evaluate OpenTelemetry async context/trace links, sampling, cost and privacy; no schema solely for tracing. Loki/Tempo/Alloy/cAdvisor require evidence/approval, no new observability deployment. Alertmanager and independent Telegram/email delivery with dedup/fallback per OPS03. Read-only Operations Center, no raw logs or arbitrary commands. Private role-specific metrics/health; no Docker socket in worker. Verify privacy, freshness, aggregation, resource limits and actual alert delivery. See [notification operations](../operations/notifications.md).

## BW09 — Testing & Failure Recovery

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237132480).

Layer unit/contract/property/integration/multi-process/recovery tests with Vitest, real PostgreSQL/Redis, LF03 fast-check deterministic seeds, existing Compose/k6/recovery scripts. No universal coverage target. Existing independent DB-client tests are useful, not proof of actual process crash. Evaluate Testcontainers and Toxiproxy only through separately scoped pilots where reproducibility, maintenance or CI cost improves; use protocol-specific SMTP test sink for lost acknowledgments. Use synthetic isolated data, credentials, network and volumes, destructive test guards, never production faults or actual external sends.

| Failure checkpoint                                | Required evidence                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Before/after claim                                | No lost committed event; expired claim recovers with new fence              |
| Before/after DB commit                            | Atomic rollback or durable result; no duplicate logical effect              |
| SIGTERM / SIGKILL                                 | Bounded drain or lease recovery; stale completion rejected                  |
| External admission / acceptance / completion      | Definite non-send retries bounded; ambiguous result UNKNOWN, no auto-resend |
| DB/Redis/provider slow or unavailable             | Bounded failure, security fail-closed policy, recovery without hot loops    |
| Contention, retry surge, CPU/RAM or pool pressure | Protect HTTP SLO, bounded backlog recovery, no duplicate effects            |
| Revocation, expiry, incompatible versions         | Fail closed or skip/cancel; safe diagnostics and compatible deployment      |
| Retention and restore                             | Dedup markers preserved; no resurrection or duplicate external effects      |

Assert authoritative DB state and logical effect counts, not logs alone. Extend #923 with real independent process tests, reuse existing same-image API replica rehearsal rather than duplicate it. Run k6 load/stress/spike/soak with representative authenticated read/write and worker workload; compare HTTP baseline and queue lag, throughput, retry, CPU/RAM/pool. Affected CI for routine checks, conservative full fallback for uncertain/global/security/release changes; expensive fault/load/recovery separate scoped workflows.

Integrate with S06 DR: Beta RPO <= 1h/RTO <= 4h; mature <= 15m/<= 2h. Restore isolated with workers disabled, verify deletion/revocation anti-resurrection, dedup/retention and authoritative reconciliation of post-backup external effects before reactivation. A restored PENDING record is not proof of non-send. Exact signed staging artifact and manual owner GO remain required.

## BW10 — Scaling & Implementation Roadmap

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237320013).

Consolidate the 120 owner decisions in this versioned strategy, reuse existing epics/issues/milestones, prioritize acceptance of existing PostgreSQL Outbox. Worker runtime separation after ABI08 and separate final Backend Core decision (modules/, CoreModule, core directory/package remain undecided). Work groups below are not new issues, fixed PR counts or completed work. Foundation evidence may proceed in parallel with ABI. Security and existing Beta gates take priority; multi-instance/worker acceptance is not an added mandatory Beta gate for approved disabled-worker single-instance scope.

| Work group | Scope / acceptance                                                                    | Existing owners   |
| ---------- | ------------------------------------------------------------------------------------- | ----------------- |
| BW-R01     | Strategy and job registry; reconcile source, gaps, existing PRs                       | #380, #588        |
| BW-R02     | Outbox/dispatcher cumulative acceptance; atomicity, dedup, version/replay/lease tests | #568, #569        |
| BW-R03     | Distributed scheduling, misfire and avatar/storage safety                             | #921, #923        |
| BW-R04     | Minimal worker composition/roles after ABI08 and explicit core decision               | #909, #569        |
| BW-R05     | Shared image, role probes, bounded drain, connection/resource budget                  | #922, #923        |
| BW-R06     | Metrics, heartbeat, dashboard, privacy-safe aggregation                               | #579, #316        |
| BW-R07     | Independent multi-process fault/recovery, signed restore evidence                     | #923, #351        |
| BW-R08     | Measured concurrency/backpressure/load, protect HTTP SLO                              | #313, #922, #923  |
| BW-R09     | Staging, operational acceptance, read-only Operations Center, manual rollout          | #351, #352, #1002 |
| BW-R10     | Conditional queue adoption comparison and noncritical pilot                           | #711, #569        |

Scaling levels are candidate topologies, not mandatory sequential production rollouts:

| Level | Topology                                  | Gate                                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------- |
| L0    | Embedded dispatcher in API                | Existing source; applicable flags and acceptance remain gated               |
| L1    | One API + one worker                      | ABI08/core decision, role isolation, drain, budget, recovery                |
| L2    | Multiple API + one worker                 | Shared storage, session/rate-limit/distributed jobs, measured HTTP capacity |
| L3    | Multiple API + workers                    | Multi-process claims, fairness/backpressure, resource and load evidence     |
| L4    | PostgreSQL outbox + optional queue engine | BW06 evidence, separate pilot and owner GO                                  |

No mandatory BullMQ, automatic autoscaling or premature new package/microservices. Multiple containers on one VPS are not host HA. Resource, reliability and observability acceptance must be recorded with exact SHA/digest, environment, date, workload, results, owner and limitations. No automatic activation, procurement, dependency installation or production rollout; separate owner GO. Dedicated documentation PR publishes strategy only.

### Worker PR definition of done

- Re-pin main and inspect related issues/open PRs; one independently reviewable task per PR.
- Preserve server authorization, business invariants, idempotency and concurrency safety; verify bounded retries/timeouts/TTL/fences/recovery.
- Bound loops, claims, memory, pool and concurrency; no private data or unbounded labels in telemetry.
- Update relevant contracts/docs and run risk-based unit/integration/E2E and affected checks.
- Use isolated worktree, actual local pre-commit/pre-push hooks, exact-head green CI, owner review and manual merge. Never bypass hooks.
- Record resource/reliability/observability evidence; no issue closure or release acceptance without verified criteria. Separate owner authorization for new dependencies, infrastructure, worker flags and deployment.

## Source baseline and job registry

Source review at main [06a03f58](https://github.com/sauron9521/gym-platform/commit/06a03f588b1c292b73c5e0af11634e7b05b99b90) is a documentation inventory, not fresh runtime or release acceptance. Existing #568/#569/#579 remain open; see their reconciliation and [deployment readiness](../operations/full-stack-deployment-readiness-2026-11-28.md).

| Job / owner                    | Current schedule                     | Current concurrency and bounds                                             | Target misfire / recovery                       |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Outbox / Notifications         | 15s, dispatch flag default false     | Sequential 10 claims/tick; 30s DB lease, 5 attempts                        | Bounded CATCH_UP of due work, fences            |
| Optional Email / Notifications | 15s, dispatch + email flags and SMTP | Sequential 5/tick; 30s lease, 20s send budget, 5 attempts                  | Bounded CATCH_UP, expiry/UNKNOWN                |
| Retention / Notifications      | Every 15 min, mode off by default    | Bounded batch, apply xact advisory lock, preview read-only                 | Candidate RUN_ONCE, preserve retirement markers |
| Token/session cleanup / Auth   | 03:00 Europe/Kyiv                    | Dedicated session advisory lock, 500 rows per batch, max 200 rounds        | Candidate RUN_ONCE, resume expired rows         |
| Avatar orphan cleanup / Users  | 04:00 Europe/Kyiv                    | Local overlap guard, 100 candidates, 24h grace; distributed safety pending | Candidate RUN_ONCE after storage/lock review    |

Current dispatcher retry uses equal jitter (5s initial ceiling, capped 60s); optional email provisional TTL 24h, quiet recheck 15m. These are existing policies, not universal job defaults. Current default API DB pool 10, connection timeout 5s, idle 10s; API Compose limit 2 vCPU/1 GiB, four web pilot containers 1 vCPU/512 MiB each. No worker budget selected. Validate role/time bounds, actual duration, lock loss and misfire behavior before activation; the registry does not change schedules. Existing queue snapshots use 30s cache/single-flight and cap 10,001, DB statement timeout 1.5s; failed snapshots omit gauges. Existing alert rules are provisional, real alert delivery and scale acceptance remain pending. Native reminders remain separate; no server-side reminder activation.

## Governance

Existing issue owners remain canonical; no duplicate epic or milestone. Changes to strategy require explicit owner approval and versioned documentation. Implementation and independent release acceptance remain distinct. Preserve existing security, privacy, notification, native, storage, recovery and Beta gates, including #343, #351 and #352. This document does not authorize new runtime or production work.
