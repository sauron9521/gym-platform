# OVRANTO — Release & Feature Management v1.0

**Decision: OWNER APPROVED, 2026-11-27. Recording: pending owner merge and verification in main.**

This is a cross-cutting supplement to [S06 Production & Reliability](s06-production-reliability-v1.md), not a replacement or a new product epic. [Strategic roadmap #588](https://github.com/sauron9521/gym-platform/issues/588) and [Master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353) retain ownership. S03 privacy, S04 legal, S05 security, S06 reliability, S07 analytics and independent Beta/store/commercial gates remain binding. Approval of a policy is not evidence of its implementation or permission to deploy, buy services, change DNS, send notifications or open Beta.

## 1. Infrastructure and capacity

First isolated trial deployment on the owner's home PC with synthetic/test data and Cloudflare Tunnel. Benchmark representative workloads on that PC and candidate VPS using k6 or validated existing harness: authentication, workout reads/writes, trainer assignments; sustainable/saturation RPS, concurrency, p95/p99 latency, errors, CPU/RAM, DB/pool and network. Define required traffic/headroom and acceptance thresholds from evidence before selecting capacity.

Target two API containers on a VPS; verify one can serve expected traffic while the other updates. Home API is optional only if measured benefit justifies latency, operational cost and security/reliability risk. Prefer VPS-only when adequate. Two containers on one VPS do not provide host-level HA. Shared authoritative PostgreSQL/Redis/storage, secure connections, compatible artifacts, bounded jobs/idempotency, readiness/drain and one migration execution. No production dependency on home power/network. Cloudflare-first direction is maintained; provider, VPS sizing and optional home replica remain undecided.

## 2. REST API contracts

Use native NestJS URI major versioning starting at /v1/ (api.ovranto.com), after #909 ABI08 and before public Beta. Application SemVer and API contract major are independent. Keep one modular monolith, shared domain logic and existing audience ownership. Health/readiness and protected operational metrics remain version-neutral.

Backward-compatible additions and internal fixes stay in the same API major; incompatible changes require a new contract. Support current and previous major during migration, without assuming a fixed lifetime. Inventory routes and clients first; do not rename routes without review. Coordinate runtime/test/OpenAPI exporter bootstrap, generated @gym/api-client, browser/mobile clients, middleware, guards, auth/cookie paths, CSRF/CORS, caching, rate limits, metrics and operational probes. Temporary unversioned aliases only if deployed client evidence warrants them; no unsafe redirects of writes. Approved oasdiff compatibility check (#711) uses a reviewed baseline transition for deliberate pre-Beta changes.

## 3. Application versions and release identity

Independent SemVer for API, Athlete Web, Trainer Web, Admin, Mobile and Landing. Internal-only shared packages need no public npm release. Changesets prepares versions and technical changelogs subject to private workspace/dependency graph/CI validation. GitHub Releases and component-specific tags identify versions; platform release manifest links each deployed component to exact source SHA, immutable signed artifact digest, compatible API/schema/mobile versions and evidence. Unchanged compatible components retain their artifacts.

Mobile additionally records platform build number, runtimeVersion, OTA update ID and API compatibility. OTA only for compatible changes allowed by store policy; native dependency/SDK changes require store builds. Validate EAS channels, runtime compatibility, device tests and staged store availability. Technical changelog, internal release history and localized user-facing What's New (uk/en) have separate purposes.

## 4. API Version Analytics and retirement

Server-resolved API major and normalized route are authoritative. Bounded client app/platform/version/build metadata is untrusted diagnostic context; unknown clients and anonymous traffic reported separately. Count requests and distinct authenticated active accounts over rolling 24h/7d/30d/90d, including old-only and mixed-version cohorts, per-route use, last observed use, adoption trends and absolute counts. Users may occur in multiple version cohorts; totals deduplicate across replicas. Observed activity does not measure all installed clients.

Use bounded metrics for traffic and privacy-reviewed deduplicated account/version/day activity or equivalent analytics storage for distinct accounts. No per-request DB write, user ID metric labels, raw query values, tokens or workout payloads. Limit retention, authorized aggregate access and overhead; telemetry failure must not break core requests. Retention policy remains open.

Advisory thresholds for 30-day distinct active account share using legacy API: >10% continue support; 5–10% encourage update; 1–5% prepare retirement; <1% consider removal; zero observed for 30 days is a removal candidate. Resolve exact boundary semantics in RFM01. Absolute counts, mixed clients, 90-day/offline use, telemetry quality, security, store availability and unsynced data are additional decision criteria. Never automatically delete endpoints.

Lifecycle: Active → Supported → Deprecated → Sunset scheduled → Retired. Announce deadlines, release compatible clients, observe actual adoption, obtain explicit owner GO and remove through a bounded PR with recovery plan. Maintain recovery/compatibility path for affected clients.

## 5. Client Update Management and release communication

Per Android, iOS and Web application policy: Latest / Recommended / Minimum Supported Version; verify semantic version and platform build/runtime/API ordering, actual availability and device compatibility. Manage through Super Admin with permission checks, critical step-up MFA, reason, effective date, audit and emergency cancellation. Evaluate effective status server-side; client metadata is not an authentication boundary. Keep minimal compatibility checks accessible to outdated clients.

Ordinary available update: one informational notification. Recommended update: dismissible/snoozable prompt, at most once per seven days per applicable release. Deprecation notices: 30, 14, 7 and 1 day before cutoff. Mandatory policy requires explicit owner activation, verified store availability, safe recovery and tested cancellation. Protect active workouts, unsynced drafts/export/recovery and Web unsaved forms; do not blindly block or delete data. Security exceptions require narrowly scoped safe restrictions and owner decision.

Reuse #563 inbox/outbox/dispatcher/preferences, localized What's New, in-app banners/update screens, optional opted-in push/email and quiet hours as applicable. Publish automatically only after actual confirmed availability/exposure to eligible platform/cohort; no notification on merge, draft release or flag edit. Deduplicate per release/account/platform, recheck eligibility at dispatch and stop reminders after update. Verified store links or compatible OTA path only. No new queue or marketing channel.

## 6. Feature Flags

Separate code deployment from feature exposure. OpenFeature is the approved standard; Cloudflare Flagship is preferred candidate, contingent on staging validation of SDK/API compatibility, availability, price, targeting, evaluation, outage behavior and replica consistency. If unsuitable, return for alternative provider decision.

Release/experiment/operational/kill-switch flags have typed keys, purpose, owner, safe default, review/expiry and cleanup plan. Modes: disabled, internal, selected users, Beta cohort, stable percentage, enabled for eligible audience. Target approved minimal attributes (role/app/platform/version and other reviewed attributes); opaque stable targeting keys, no unnecessary sensitive data. Deterministic cohort across sessions and replicas. Separate Dev/Staging/Prod, server-authoritative evaluation, authorized effective capabilities to clients, no provider secrets. Never replace authorization, entitlements, consent or security gates.

Super Admin controls require scoped permission, critical step-up MFA, before/after values, actor/reason, concurrency protection and reconciliation of partial provider failures. Define safe per-flag fallback and last-known-good freshness; measure kill-switch propagation and test outages. Ordinary changes preserve active workouts and unsynced data. Staged rollout internal → selected/Beta → percentage (e.g. 10/25/50/100) only after health evidence; no mandatory progression schedule. Remove obsolete temporary flags in a reviewed PR after compatibility/adoption verification. Existing environment safety gates remain until parity is demonstrated.

## 7. Database migrations and rollback

Forward-only PostgreSQL/Prisma expand-and-contract. Expand schema first, migrate/backfill with bounded resumable jobs as needed, verify adjacent runtime readers/writers, switch, contract only after obsolete readers/writers retired and explicit rollback-boundary review. Review locks, timeouts, data reconciliation and schema/data compatibility. No guaranteed zero downtime for incompatible changes.

Separate signed migration image with least-privilege migration identity; serialize migrations/deploys, execute once before compatible runtime rollout, never independently at every API startup. Rehearse exact release digests and migrations on isolated staging. Stop on failure, preserve compatible runtime or use maintenance/forward fix. Roll back runtime only to verified compatible signed artifact; never automatically reverse/restore DB. Automatic rollout stop and return traffic to healthy replicas; automatic runtime rollback only under pre-authorized tested policy, bounded attempts, schema/data and health evidence, audit and alert. Otherwise freeze and require owner decision.

DB disaster recovery is independent and owner-approved. Retain S06 Beta RPO ≤1h/RTO ≤4h, encrypted off-host copies, WAL/PITR or proven equivalent, restore drill before Beta and monthly thereafter, DB/media/outbox consistency and anti-resurrection. R2 is only a backup destination candidate; validate credential/key isolation, retention/deletion protection and actual restores. Record release/migration IDs, immutable digests, timestamps, outcome, reason, actor/automation and evidence without secrets.

## 8. Release automation and deployment

Trunk-Based Development: protected main, short-lived PR branches, manual owner merge, no permanent develop/staging/production branches. GitHub Actions is primary CI/CD. Automatic Changesets candidate preparation and exact-SHA green CI, signed artifact build/verification/GHCR publication, automated isolated staging deployment and smoke/E2E/evidence. Existing manual workflows remain until reviewed replacements are validated. Promote identical verified artifacts to Production by immutable digest, never rebuild at promotion.

Manual owner Production approval of exact release and evidence; no mandatory second approver. Verify environment protection capabilities, isolate credentials and preserve independent security/legal/reliability gates. Automated rolling deployment drains and checks readiness, runs migrations once, stops on failure, observes ≥30 minutes. Feature exposure requires owner authorization; only then eligible release communications. No automatic production deployment on merge.

Turborepo dependency graph determines changed/affected components with conservative global-input invalidation, full main release evidence and all required checks retained. Reuse unchanged compatible digests. Channels: optional isolated Preview, Staging, Beta cohorts via flags/appropriate mobile channels, Stable. Hotfix PR → CI → staging smoke → owner approval → deployment; no bypass of critical gates. If main contains unsafe unreleased work, temporary branch from deployed release and reviewed forward-port to main. No new orchestration stack by default.

## 9. Release monitoring and incidents

Centralize metrics/logs/traces and bounded release/environment/service dimensions; deployment markers and before/after comparisons. Monitor API, DB, Redis, workers, Web, Mobile, VPS, network and backups as implemented. Synthetic critical auth, workout read/write, Trainer assignment and sync journeys; no personal or secret data in telemetry. Missing/stale data is UNKNOWN, not healthy. Numeric stop/rollback thresholds follow measured baseline and reviewed operational runbook.

At least 30 minutes active post-release observation (longer for high-risk releases). P0–P3 use S05/S06 classification, unified incident history: detection, triage, containment, recovery, verification, communications, postmortem and tracked follow-ups. Independent Telegram/email for P0/P1 with real delivery tests, dedup/retry/heartbeat and operator fallback; alert origin independent of failed app, avoid common delivery dependencies. Admin is supplementary, not the sole alert channel.

Super Admin Operations Center initially read-only: freshness, component and version health, incident links and evidence; no raw logs or arbitrary infrastructure commands. Independent status.ovranto.com remains reachable when main VPS is down, publishes minimal public service states, incident updates and maintenance; safe manual override/audit, truthful unknown/degraded states. Provider and DNS activation not yet approved.

Reuse current Prometheus/Grafana/Alertmanager tooling and approved Pino direction. Evaluate Loki, OpenTelemetry, Sentry, Healthchecks.io, Uptime Kuma and Cloudflare Analytics against demonstrated gaps, costs, privacy and availability; no blanket install. Keep S06 Beta 99.5% rolling-30-day availability target and paid target 99.9%; targets are not achieved claims.

## 10. Super Admin and authority

One Platform Management navigation: Release Management, API Version Analytics, Feature Flags, Client Update Management, Release Notifications, Operations Center, Incident Management, Audit History. Reuse existing authorization/audit/notification infrastructure; release and operational views initially read-only. Deploy/rollback controls remain protected GitHub Actions; no generic infrastructure command API. Critical policy mutations require scoped RBAC, step-up MFA, validation and audit. Explicit owner GO for production, retirement, mandatory-update activation and critical exposure; separate product/legal/security/reliability gates remain.

## 11. Delivery coordination and open decisions

| Scope                                              | Canonical owners                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capacity, topology, replicas                       | [#313](https://github.com/sauron9521/gym-platform/issues/313), [#923](https://github.com/sauron9521/gym-platform/issues/923)                                                                                                                                                                                                |
| URI contracts, oasdiff                             | [#909](https://github.com/sauron9521/gym-platform/issues/909), [#287](https://github.com/sauron9521/gym-platform/issues/287), [#711](https://github.com/sauron9521/gym-platform/issues/711)                                                                                                                                 |
| Release automation, affected builds                | [#323](https://github.com/sauron9521/gym-platform/issues/323), [#335](https://github.com/sauron9521/gym-platform/issues/335), [#374](https://github.com/sauron9521/gym-platform/issues/374), #711                                                                                                                           |
| Version analytics, client updates, release history | [#1000](https://github.com/sauron9521/gym-platform/issues/1000)                                                                                                                                                                                                                                                             |
| Feature rollout                                    | [#1001](https://github.com/sauron9521/gym-platform/issues/1001)                                                                                                                                                                                                                                                             |
| Notifications                                      | [#563](https://github.com/sauron9521/gym-platform/issues/563)                                                                                                                                                                                                                                                               |
| Migrations, backup, restore, release gates         | [#317](https://github.com/sauron9521/gym-platform/issues/317), [#351](https://github.com/sauron9521/gym-platform/issues/351), [#352](https://github.com/sauron9521/gym-platform/issues/352), #923                                                                                                                           |
| Operations, status, incident evidence              | [#1002](https://github.com/sauron9521/gym-platform/issues/1002), [#316](https://github.com/sauron9521/gym-platform/issues/316), [#350](https://github.com/sauron9521/gym-platform/issues/350), [#579](https://github.com/sauron9521/gym-platform/issues/579), [#393](https://github.com/sauron9521/gym-platform/issues/393) |

Use existing issues and one independently reviewable PR at a time. Re-pin main, inspect open PRs, preserve existing P0/Beta priorities and verify evidence before marking done. No new competing implementation epic.

Open decisions: home/VPS final topology and capacity; Flagship validation and alternative if unsuitable; R2 backup feasibility; status/monitoring provider selection and spending; numeric alert/retirement boundary semantics, telemetry retention, actual cutoff dates and release cadence. Normal production 1–2/week and native store 2–4 weeks remain planning suggestions, not SLA. No new live configuration or operational readiness is asserted.

## Decision record

All owner approvals are dated 2026-11-27 in #588:

- [Initial release direction](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226077197)
- [Topology and API versioning](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226307115)
- [Application versions and release records](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226444943)
- [API analytics and notifications](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226549430)
- [Feature Flags](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226689637)
- [Client Update Management](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7226751904)
- [Database migration and rollback](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7227117152)
- [Release automation](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7227206826)
- [Release monitoring and incidents](https://github.com/sauron9521/gym-platform/issues/588#issuecomment-7227330465)

Related operational runbooks: [release publication](../operations/release-ghcr.md), [two-release rehearsal](../operations/staging-two-release-rollback.md), [operations index](../operations/README.md). Existing operational workflows and evidence requirements stay authoritative until reviewed updates land.
