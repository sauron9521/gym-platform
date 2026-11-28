# OVRANTO — Observability & Monitoring Strategy v1.0

- **Decision:** OWNER APPROVED, OM01–OM10 (120 decisions), 2026-11-28.
- **Publication:** manual owner merge and main verification required.
- **Source baseline:** [7831bc6](https://github.com/sauron9521/gym-platform/commit/7831bc6d264c8d951d2d7be50a2c3d9b78ffc7eb); source inventory and retained evidence, not a fresh runtime acceptance run.
- **Authority:** [#380](https://github.com/sauron9521/gym-platform/issues/380), [#588](https://github.com/sauron9521/gym-platform/issues/588), [#353](https://github.com/sauron9521/gym-platform/issues/353); [S03](s03-privacy-data-ownership-v1.md), [S04](s04-legal-compliance-v1.md), [S05](s05-security-trust-v1.md), [S06](s06-production-reliability-v1.md), [S07](s07-product-analytics-experiments-v1.md), [Release & Feature Management](release-feature-management-v1.md), [Background Workers](background-workers-strategy-v1.md), [Shared Packages](shared-packages-strategy-v1.md), [INF01](../operations/infrastructure-hosting-decision.md).
- **Limit:** strategy only; no new dependency, runtime configuration, infrastructure purchase, provider selection, collection, cutover, issue closure, or Beta/production GO. Separate owner approval and evidence required.

## OM01 — Observability Architecture

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237781493).

Unified observability across Athlete/Trainer/Admin/Landing Web, Mobile, NestJS API and workers, PostgreSQL, Redis, containers/host, edge, storage, backups and external integrations. Separate metrics, logs, traces, application errors and independent synthetic monitoring. Grafana ecosystem and OpenTelemetry are the target direction, not a mandatory all-at-once stack. Retain Prometheus, Grafana, Alertmanager and Blackbox Exporter; evaluate Alloy as collector, Loki/Tempo/OTel as justified and Sentry behind privacy/build gates. Direct private scrape and separate error transports remain valid; one owner per signal, no forced collector hop.

Technical Grafana is separate from authorized read-only Operations Center and independent public status page (#1002). Expose bounded aggregate state, observation time, UNKNOWN for missing/stale and disabled separately; never expose raw logs, traces, secrets, arbitrary commands or customer data in Admin/public status. Independent observer and critical alert routing survive primary-host failure. Home staging is not the sole observer. Keep application containers unprivileged without Docker socket. Evaluate vendor, region, legal basis, access, resource overhead, licensing/security and gross costs before activation. Library-first shadow/parity replacement; retain platform-specific verification.

## OM02 — Metrics & Prometheus

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237857878).

Prometheus is primary metrics backend. Evaluate prom-client with a scoped registry behind the current API interface; preserve names, types, units, labels, zero-series behavior, reset semantics, cumulative buckets, started/aborted/in-flight and finish/close single settlement, exclude metrics scrapes from HTTP SLI. Keep the opt-in authenticated private /internal/metrics endpoint, indistinguishable 404 for disabled/unauthorized, no-store and ingress denial. No unconditional default metrics or second OTel metrics pipeline. OTel metrics remain a future evaluation, one instrumentation owner per signal.

RED (rate/errors/duration) for services and USE (utilization/saturation/errors) for resources. Preserve 11 finite HTTP histogram buckets (0.005 to 10 seconds) and +Inf/sum/count; choose operation-specific buckets only with evidence. Calculate per-process rates/increases before summing, aggregate compatible buckets before quantiles, never average p95 or sum duplicated shared DB gauges across replicas. Existing rolling-window gauges are not counters. Preserve bounded queue snapshots, DB query/cache/timeout limits, failed snapshot omissions, explicit enabled vs healthy and UNKNOWN. Track 429/503/aborts separately, verify denominator and coverage; no healthy zero for absent/stale metrics.

Document metric name/type/unit/owner/source, bounded label allowlist, cardinality budget, aggregation/freshness, consumer and tests. No user/request/trace IDs, raw URLs, SQL, messages or secrets in labels. Route templates only when justified. Standard Unix/Node, container, PostgreSQL, Redis and Blackbox exporters require least privilege, private network and measured overhead. Scrape intervals (15–60 seconds) and 45-day retention are evaluation proposals; preserve sufficient verified history for rolling 30-day SLI, disk limits and WAL/compaction headroom. No premature shared metrics package. Shadow namespace separate from live rules; parity, resource and negative security evidence and explicit migration GO.

## OM03 — Structured Logging & Pino

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7237926526).

Follow existing LF07 (#711) for Pino/nestjs-pino server pilot; preserve Nest Logger interface and avoid mass rewrite. Verify exact Node/Nest/ESM compatibility and bootstrap/shutdown, preserve LOG_LEVEL (log to info, verbose to trace), production JSON stdout, development pretty logging where appropriate. Stable event codes and versioned JSON convention: timestamp UTC, level, service, environment, release, event, context and approved scoped correlation IDs. Preserve server-generated UUID request ID and X-Request-ID, exception mapping, existing AsyncLocalStorage DB timing and request settlement; no duplicate automatic HTTP logging or parallel context framework. Runtime-appropriate Web/mobile diagnostics; no browser Pino requirement or premature shared logger package.

Use explicit field allowlist plus source and collector redaction; safe serializers, no raw headers/bodies/URLs/SQL/params/token/PII/exception text or arbitrary object logging. Opaque IDs/hashes are pseudonymous, restricted access. Separate application diagnostic logs, security events and authoritative durable audit records; AdminAuditLogger alone is not a compliance audit trail. Optional diagnostic sampling must not drop required audit records or alter security alerts. Bound record size/volume/buffers, backpressure, rotation, shutdown and drop visibility; optional telemetry failure must not block business operations. Preserve event/time schema and downstream Docker forwarder/log-window consumers or explicitly version and migrate after parity. Test concurrent and detached context, privacy, failure/overload and collector behavior before cutover.

## OM04 — OpenTelemetry & Distributed Tracing

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238020520).

OTel and OTLP are the tracing standard, independent of storage vendor. Isolated deterministic exporter first, verify Node 24, ESM bootstrap before instrumented imports, NestJS 12, Prisma 7 and actual Docker lifecycle. Selectively evaluate HTTP/Express/Nest, Prisma/pg, ioredis and Pino instrumentation; avoid duplicate spans/metrics/log exports. Manual spans only for useful critical operations, not every method. Incremental Next.js server hook pilot, no premature mobile SDK or shared telemetry package. Preserve request UUID and DB timing; W3C trace context through reviewed destinations, public context untrusted, validate/restart/link by policy; no arbitrary baggage, sampling bypass or authorization based on trace headers.

Worker attempts use independent bounded spans and span links when safe context exists; durable event/job identity independent of traces, no Outbox schema migration solely for tracing. Respect ABI08 and separate Backend Core decision before worker runtime separation. Allowlisted operation/route/status/duration/release/environment/error category; no raw SQL/params/URLs/headers/bodies/credentials/PII or unrestricted exception text. Private authenticated/TLS OTLP; bounded batch/queue/retries/timeout/drain, drop diagnostics and safe degradation. Head sampling first (5–10% production only a hypothesis), tail sampling only with measured need, complete trace routing and memory budget; cannot recover discarded spans. Test concurrent isolation, lost/untrusted context, actual outbound attributes, outage, overhead and shutdown before rollout.

## OM05 — Grafana Alloy & Infrastructure Collectors

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238140574).

Prefer Alloy embedded components over duplicate permanent agents if compatible, bounded and safe; standalone when isolation/privilege/availability warrants. Direct API scrape and independent external Blackbox remain. Evaluate Unix, PostgreSQL, Redis exporters with least-privilege roles; pg_stat_statements requires separate configuration, query/privacy and overhead review, no raw SQL/query-ID labels. Docker log collection follows LF07 schema/consumer parity, positions/restart/rotation/drop/duplicate tests. Measure collector CPU/RAM/disk/network/cardinality; no assumed sizing.

Continue the existing [production observability runbook](../operations/production-observability.md) and [shadow evidence](../operations/evidence/resource-shadow-45504926927.json). Retained basic experiment status observed-not-parity: CPU maximum difference 0.455201 percentage points, RAM 0.061809, three PID observations matched; CFS period differences 2/135/2, nonzero throttling/OOM not exercised. These are observations, not approved tolerances. Resume checkpoint: separate bounded quota/throttle scenario on explicitly approved disposable hosted Linux VM, synchronized identity/windows/deltas with nonzero denominator and throttling, then separate lifecycle/OOM/recreation, repeated observations, overhead and alert agreement. Keep Docker inspect/events, freshness and old collectors authoritative; threads not necessarily PIDs, missing/stale/reset not zero, core utilization distinct from quota.

No privileged experiment on developer/shared/production host; Docker socket :ro does not restrict Docker API to reads. Exact fixture/metric/label allowlists, no metadata/secrets, pinned reviewed versions/provenance/license/security, privilege review and safe cleanup. Do not transplant privileged fixture to production. AL01–AL10 groups map into unified roadmap below; no new issues or cutover permission.

## OM06 — Loki & Tempo

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238485146).

Loki candidate for centralized logs and Tempo candidate for traces, LogQL/TraceQL and Grafana cross-signal links. Preserve authoritative metrics; sampled trace-derived signals cannot replace full request counters or durable audit. Bounded service/environment/role/level labels; scoped request/trace IDs only as approved structured metadata/fields, never indexed high-cardinality labels. Correlation links/exemplars depend on sampling/retention/access. Loki single-binary staging pilot after LF07 and log collector parity; Tempo monolithic pilot after OTel evidence. Verify actual supported deployment modes, no distributed cluster requirement.

Local isolated volumes for pilots; evaluate production object storage including R2 S3-compatible operations, region, credentials, cost, WAL/index/block/compaction/deletion. Separate logs/traces buckets, environment identities and credentials from backup/media, least privilege; no lifecycle deletion that corrupts active blocks. Evaluate 14d logs/7d traces/45d metrics as proposals, not approved settings. Bound ingest, record/attribute size, query timeout/concurrency, disk, WAL, compaction, network and storage costs. Authentication/authorization at ingest/query boundaries, TLS/private networking, role-protected Grafana, source minimization and safe degradation. Compare self-hosted, managed, hybrid (evaluate hybrid first) on full cost, data region/DPA, deletion/retention, availability and operational burden. No provider or spend selected. LT01–LT10 consolidated below.

## OM07 — Sentry & Application Error Monitoring

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238710096).

Sentry candidate for error/crash grouping and regressions, not replacement for Prometheus/Loki/Tempo. Mobile-first under #348/#349/#350; preserve [M12.1 diagnostics contract](../../apps/mobile/docs/crash-monitoring.md), strict render_failure/api_server_failure v1 events, optional server UUIDv4, no configured sink, max 20 attempts/config epoch, one in-flight, no persistence/retry, revoke/abort and epoch isolation. Verify signed isolated preview builds, approved API destination, legal basis/permission lifecycle, region/DPA, retention/deletion, SDK compatibility. JS and native capture paths separately reviewed; native SDK may bypass JS hooks. Actual Android/iOS physical-device render and controlled native fatal crash, symbolication, ANR/hangs where supported, no test crash actions in production. Test offline/restart, account switch, denied/revoked permission, no unintended sends and env isolation.

Allowlisted code-frame schema separately approved. Inspect real outbound envelopes, stored events, native crash files/queues and SDK metadata; no identity/IP where supported, unrestricted exception messages/stacks, headers/body/URLs, tokens, workout data, screenshots, replay, breadcrumbs, attachments, profiling/tracing or sessions unless separately reviewed. Source maps/debug IDs, R8/native symbols/dSYM as applicable match exact immutable build and Expo runtimeVersion/OTA; upload secrets build-only, protected source artifacts. Keep X-Request-ID, safe error categories/grouping, deduplicated error capture; expected auth/validation/404/offline/abort not automatically sent. Incremental Next.js, API and worker pilots, one OTel tracing owner; no duplicate tracing. Regression data informs manual release review, not automatic rollback; crash-free sessions require separately approved session collection and sufficient denominator. Managed Sentry evaluation first within INF01 budget, compare alternatives if privacy/cost unmet; no account or SDK activation. SE01–SE10 consolidated below.

## OM08 — SLI, SLO & Alerting

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238798344).

Preserve S06 internal availability targets: Beta 99.5%, paid 99.9%, rolling 30 days including planned maintenance. No contractual SLA or achieved SLO assertion. Time-equivalent full-outage budgets 216 minutes and 43.2 minutes respectively; not request-weighted budgets. RPO/RTO unchanged (Beta <=1h/<=4h; paid targets <=15m/<=2h). Existing nine HTTPS probes are L1 transport/health only; add scoped L2 authenticated reads/login and L3 synthetic persistence/reconciliation for critical journeys after review. Isolated identities/data, idempotent writes/cleanup, no real-user mutation, external sends or product analytics pollution. Define expected observation slots, weighting, timeout/partial failures, eligibility, coverage. Missing observations UNKNOWN and no success credit; no achieved SLO without sufficient coverage/history. Keep request-weighted SLI separate, existing completed-response denominator excludes 4xx/aborts and cannot cover edge outages; review 429/aborts and minimum sample semantics. Baseline before thresholds.

Error-budget policy informs release prioritization; proposed 75/50/25% remaining bands and multi-window burn rates 14.4x (1h/5m), 6x (6h/30m), 3x (24h/2h), 1x (3d/6h) require sample/coverage and low-traffic validation, not live paging or auto-freeze configuration. Security/recovery hotfix exceptions owner-reviewed; SLO never waives independent gates. Prometheus recording rules and Alertmanager primary, evaluate Sloth or Pyrra only after definitions/parity/cost review. Existing alert severity is not automatically P0/P1 incident; classify user impact, security, integrity. Preserve INF07 isolated rehearsal ([delivery fixture](../../ops/monitoring/alert-delivery/README.md)); loopback receivers are not actual independent owner delivery.

Two independent Telegram/email paths for P0/P1, grouping/dedup/inhibition/retries/resolved notifications, audited expiring silences, heartbeat/dead man's switch and independent observer. No reliance on failed application/DB or common SMTP route; actual owner receipt, receiver/observer outage and recovery drills. Healthchecks.io/Uptime Kuma candidates only. Protected Grafana SLO view shows per-journey coverage/freshness/UNKNOWN/disabled. OPS01–06 #1002 read-only Admin, independent status page, incident timeline and safe public communications, no duplicate alert engine. S05/S06 P0–P3 detection/triage/containment/recovery/verification/communication/postmortem, actionable runbooks, P0/P1 postmortems, minimum 30m active post-release observation and longer risk-based, manual rollback/GO.

## OM09 — Monitoring Scripts Replacement

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7238962735).

Inventory at source baseline: 11 non-test scripts/modules, 1,599 lines including 38-line privileged publication helper; 9 monitoring test files. Reduction is not a LOC target. Keep reference semantics and tests until equivalent replacement verified.

| Existing file in scripts/         | Direction / gate                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| monitoring-docker-resources.mjs   | Partial Alloy/cAdvisor after aligned CPU/RAM/PID and alert parity                                    |
| monitoring-docker-signals.mjs     | Partial; retain inspect/events/OOM window/lifecycle/freshness until equivalent                       |
| monitoring-docker-forwarder.mjs   | Alloy log pilot after LF07, trust/streaming parity                                                   |
| monitoring-forward.sh             | Remove only after verified forwarder cutover                                                         |
| monitoring-log-window.mjs         | Native counters/PromQL or bounded LogQL after parity                                                 |
| monitoring-report.mjs             | Split aggregate rules and Blackbox health; preserve CLI semantics until migrated                     |
| monitoring-collect.sh             | Remove only when all consumers have migrated                                                         |
| monitoring-textfile.mjs           | Reduce, retain atomic writer used by backup health                                                   |
| monitoring-docker-publication.mjs | Keep until dependent trusted Docker collectors retired                                               |
| monitoring-backup-health.mjs      | Preserve specialized freshness/checksum/archive verification; evaluate pgBackRest signals separately |
| monitoring-shadow-evidence.mjs    | Keep sanitized acceptance evidence and tests                                                         |

Status-class counters do not reproduce exact 429/503 counts; verify native bounded counters and denominator/exclusions, Redis unavailable/recovered transitions, reset and scrape gaps, health probes/status/timeout and freshness before replacing report pipeline. Never rate overlapping window gauges. Log streaming positions differ from atomic ten-minute snapshot/five-minute aggregation; verify rotation/restart, missing/duplicate/dropped/malformed/skew, privacy sentinels, failure freshness and alert equivalence. Preserve distinct privileged/unprivileged atomic publication modes and stale-on-failure. No raw logs beyond reviewed trusted boundary. Backup metadata is not verified restore; retain specialized DB/media integrity/recovery evidence, #351. Vector alternative to Alloy, Fluent Bit deferred, OTel Collector alternative not duplicate. Shadow metrics isolated from live alerts; staged owner-approved cutover and rollback; only then remove obsolete scripts/timers/references. MR01–MR10 consolidated below.

## OM10 — Implementation Roadmap

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7239097313).

One roadmap uses existing epics/issues/milestones. AL/LT/SE/MR identifiers are work groups, not new tickets or fixed PR counts. Reuse existing scopes; create tasks only for demonstrated gaps after audit, not as part of this publication.

| Slice  | Delivery / consolidation                                                                                                                            | Existing owners              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| OM-R01 | Strategy, inventory, ownership, registry, AL01/LT01/SE01/MR inventory                                                                               | #380, #588, #353, #711       |
| OM-R02 | Minimum pre-Beta foundation: private metrics, independent observer, actual alerts, backup/staging evidence, MR06 probe parity, MR09 backup signals  | #316, #351, #352, #1002      |
| OM-R03 | Native metrics/prom-client pilot, exact HTTP/Redis parity MR04, BW08 shared queue semantics                                                         | #316, #579, #922, #923, #711 |
| OM-R04 | LF07 Pino, MR05 schema/consumer parity                                                                                                              | #711, #316                   |
| OM-R05 | AL02–06/08/09, MR01–03: resume isolated throttle, lifecycle, overhead, scoped exporters and resource shadow parity                                  | #711, #922, #923             |
| OM-R06 | SE01–10: mobile preview/privacy/device gates first, then scoped Next/API/Worker error pilots and release metadata                                   | #348, #349, #350, #316, #711 |
| OM-R07 | LT02–04, AL07/MR07–08: Loki/log ingestion after R04 and collector parity; bounded LogQL                                                             | #711, #316                   |
| OM-R08 | OTel deterministic/API/DB/Next/worker pilot, LT05–07 Tempo and correlation; LT08–09 storage/retention/failure evaluation shared with R07            | #316, #579, #711, #923       |
| OM-R09 | SLI definitions, baseline, burn-rate review, OPS01–06 read-only Ops Center/status and incident drills; starts with R02, not dependent on Loki/Tempo | #313, #352, #1002            |
| OM-R10 | AL10/LT10/MR10, accepted replacement only, rollout/rollback, cleanup and measured scaling                                                           | #711, #351, #923             |

R02 and existing mobile acceptance requirements take precedence. Pre-Beta requires proven minimum observability, independent delivery, recovery and physical-device evidence under existing S06/DEP/O4 gates, not every advanced tool. R03–05 standardization is incremental; R06 mobile work independent of Loki/Tempo. Advanced storage/tracing and mature operations only as justified. Multi-instance/worker separation is not a new Beta gate and remains subject to BW and ABI08/Core decisions. Existing [deployment readiness review](../operations/full-stack-deployment-readiness-2026-11-28.md) retains NO_GO and pending evidence; this document does not supersede later verified acceptance.

INF01 Hetzner DE, self-hosted PostgreSQL, EUR50 maximum monthly infrastructure budget including gross recurring cost as documented. Existing monitoring allowance EUR5 and other allocations are planning assumptions, not live quotes or approved spend. Verify full costs (taxes, storage/request/egress, disk, monitoring, alerts, backups, domain, resource headroom), mandatory recovery and independent observer before provider/hosting GO. Do not silently exceed cap or weaken mandatory gates. Defer Mimir, Kubernetes, distributed Loki/Tempo, self-hosted Sentry cluster, duplicate agents, premature shared packages, custom APM framework and automatic rollback from unverified thresholds.

### Definition of Done and acceptance gates

- Re-pin latest main, review open related PRs, one task per PR, document signal owner/consumers and avoid duplicate instrumentation.
- Privacy/security: least privilege, allowlisted fields/labels, bounded cardinality, no secret/PII leaks; test malicious inputs, actual outbound data and access boundaries, review version/license/provenance and provider terms.
- Resource: measure representative CPU/RSS/disk/network/ingest/query/cardinality and API/DB/worker impact, including overload and failure; compare baseline, establish budgets before cutover.
- Parity: exact signal semantics, counters/resets/aggregation, freshness/UNKNOWN, dashboards/alerts, lifecycle and rollback; independent shadow namespace, positive/negative fixtures and actual staged evidence. Retain authoritative old path until approved cutover.
- Failure: exporter/collector/storage outages, missing/stale data, restart/rotation/drop/duplicate, bounded queues/timeout/shutdown, independent actual alert receipts; no optional telemetry dependency for business correctness. Preserve durable audit and backup verification.
- Relevant unit/integration/e2e/parity tests, documentation/runbooks and rollback plan; real worktree install and standard Git hooks without bypass, exact-head green CI, manual owner review and merge. Unrun checks explicitly NOT RUN; no green CI claim from local tests.
- Separate owner GO for new dependencies, provider/spend, privileged experiments, migration/cutover and production rollout. Publication/implementation/acceptance/release are separate states; no issue closure without verified evidence.

## Source and acceptance references

- [Production observability and resource checkpoint](../operations/production-observability.md)
- [Notification operations](../operations/notifications.md)
- [Backup and restore operations](../operations/backup-restore-operations.md)
- [INF07 alert delivery rehearsal](../../ops/monitoring/alert-delivery/README.md)
- [Mobile diagnostics](../../apps/mobile/docs/crash-monitoring.md)
- [S06 and release gate](s06-production-reliability-v1.md)
- [Tooling adoption #711](https://github.com/sauron9521/gym-platform/issues/711), [Operations Center #1002](https://github.com/sauron9521/gym-platform/issues/1002), [Beta review #352](https://github.com/sauron9521/gym-platform/issues/352)

All prior approval links above are canonical. Candidate versions, sampling, retention, sizing, numeric paging thresholds and provider selection remain open; no live configuration or evidence of achieved SLO, native crash reporting, resource parity or production readiness is asserted.
