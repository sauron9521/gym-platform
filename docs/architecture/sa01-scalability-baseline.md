# SA01 — Architecture dependency and scalability baseline

- Issue: [#918](https://github.com/sauron9521/gym-platform/issues/918), E14 [#354](https://github.com/sauron9521/gym-platform/issues/354).
- Snapshot: 2026-11-26, [main de8c9ee](https://github.com/sauron9521/gym-platform/commit/de8c9eeb45b173e90934652b8d8c31514581e6d8).
- Status: partial static inventory; exhaustive AST export and local verification pending. Not a new ADR, runtime change, release gate or scaling approval.
- Existing decisions: [ADR-007](adr-007-pragmatic-clean-architecture.md), [ADR-010](adr-010-segregated-api-interfaces.md), [ADR-006](adr-006-shared-package-boundaries.md), [notification delivery](notification-delivery.md).

## Measured source inventory

The Git tree at the pinned commit returned 2,239 entries (including directories), not truncated. All 11 feature module registration files were inspected. There are 386 tracked TypeScript files under those feature directories (including tests); 5 files under domain directories and 14 under application directories. These counts are file counts, not compliance scores.

Direct feature-to-feature imports in the 11 Nest module registration files:

- Account deletion requests (8 TS files): none; imports shared rate-limit infrastructure.
- Auth (76): Users.
- Body measurements (23): none.
- Exercises (29): Trainer–Athletes, Users.
- Notifications (9): none.
- Trainer–Athletes (32): Users.
- Trainer onboarding (19): none; imports shared admin audit infrastructure.
- Training Programs (89): Exercises, Trainer–Athletes, Users.
- Users (50): none; imports shared admin audit infrastructure.
- Workout Analytics (13): Users.
- Workouts (38): Exercises, Trainer–Athletes, Users.

There are 11 directed edges in this registration graph. Users has six incoming edges; Exercises and Trainer–Athletes each have two and three respectively. This graph is acyclic by inspection; it does not include every runtime import, type-only dependency, dynamic provider, common/infra dependency or DI resolution check.

Five feature modules export six service providers: Users (UsersService, UsersAuthFacade), Exercises, Trainer–Athletes, Training Programs and Workouts (one each). Three feature roots have a public-api.ts: Users, Exercises, Workouts. Three are explicitly opted in to inner-layer checks: Training Programs, Workouts, Trainer–Athletes. Notifications and Trainer Onboarding already have domain files outside this explicit opt-in set; review them under #920, not as presumed violations.

## Cross-feature contracts

Observed runtime edges outside or through registration, and type-only examples:

- Workouts → UsersService, ExercisesService, TrainerAthletesService: broad injected service contracts in [workouts.service.ts](../../apps/api/src/modules/workouts/services/workouts.service.ts). Existing exported providers are allowed by the current guard, not defects by themselves.
- Workouts → Exercises public API: [workout-creation.repository.ts](../../apps/api/src/modules/workouts/repositories/workout-creation.repository.ts) uses the canonical visibility predicate and select inside the locked transaction. #650/#651 are complete; preserve this contract and lock order.
- Workout Analytics → Workouts: runtime pure public policy and type-only WorkoutActor; also UsersService in [workout-analytics.service.ts](../../apps/api/src/modules/workout-analytics/services/workout-analytics.service.ts). This is an extra source edge beyond the registration graph, not a Nest module dependency.
- Trainer–Athletes → Exercises: type-only ExerciseAccessContext in [trainer-athletes.service.ts](../../apps/api/src/modules/trainer-athletes/services/trainer-athletes.service.ts), while Exercises imports Trainer–Athletes at runtime. Do not turn this reverse type reference into a runtime cycle.
- Training Programs → Users: capability reads in [training-program-access.service.ts](../../apps/api/src/modules/training-programs/services/training-program-access.service.ts).

Candidate #919: a narrow Users capability-read contract is a useful pilot because several consumers already read persisted capabilities. Inspect actual call counts and overlap with #917 before selecting the first consumer. Never replace authoritative transaction-time access checks with preflight facade reads. Separate pure public exports from DI contracts; do not create new generic service/repository layers for CRUD.

The [feature guard](../../apps/api/scripts/check-feature-dependencies.mjs) distinguishes runtime/type-only edges, checks feature and Nest registration cycles, verifies exported providers and accepts explicit public-api contracts. It currently permits services/ and types/ paths. There is no private-import exception allowlist in the inspected current guard; historical exceptions #648/#650/#652 must not be reintroduced. The existing clean layer checks are opt-in. #920 owns any stricter guard, #909 owns audience separation. Do not treat current allowed imports as failing CI.

## Replica readiness and evidence

- **P1 / #921 — local filesystem:** [AvatarDiskStorage](../../apps/api/src/modules/users/avatar/avatar-disk.storage.ts) saves and reads files under a process-local path; [AvatarService](../../apps/api/src/modules/users/avatar/avatar.service.ts) injects it directly. Independent hosts cannot share these files. Introduce a narrow storage contract before provider selection; preserve DB commit/cleanup and authorization semantics.
- **P1 / #922 — PostgreSQL pool budget:** [PrismaService](../../apps/api/src/infra/database/prisma.service.ts) uses PrismaPg with connectionString and UTC onConnect, no explicit pool limit in this constructor. Do not infer adapter defaults or live DB capacity. Budget API/worker pools plus migrations and dedicated lock sessions, then measure. No PgBouncer by default.
- **P1 / #923 — Redis topology:** [DistributedThrottlerStorage](../../apps/api/src/common/rate-limit/distributed-throttler.storage.ts) uses memory only when Redis is not configured; configured Redis failure returns unavailable, never silently falls back. Shared Redis must be required for multi-instance global throttling. Validate deployment configuration and auth throttle parity before enabling replicas.
- **P1 / #923 — scheduled jobs:** [AppModule](../../apps/api/src/app.module.ts) registers ScheduleModule in the HTTP process. [TokenCleanupService](../../apps/api/src/modules/auth/services/token-cleanup.service.ts) uses bounded batches, waitForCompletion and [AuthCleanupLockService](../../apps/api/src/modules/auth/services/auth-cleanup-lock.service.ts) with a dedicated PostgreSQL advisory-lock session. Preserve that guarantee. [AvatarOrphanCleanupService](../../apps/api/src/modules/users/avatar/avatar-orphan-cleanup.service.ts) has no distributed lock in inspected source; assess repeated scans, storage semantics and safe deletion with two instances before choosing a scheduler owner. These are observed jobs, not a proven exhaustive cron inventory.
- **P1 / #568 and #569 — durable work:** the [outbox migration](../../apps/api/prisma/migrations/20261125120000_notification_outbox/migration.sql) and MFA producer (#831) already exist, including unique event key and lease/status indexes. Generic publisher/replay and dispatcher acceptance remain open. Preserve PostgreSQL-backed leases, bounded retry and consent; separate worker entrypoint only after evidence, no BullMQ dependency by default.
- **P1 / #923 — sessions and lifecycle:** [PrismaSessionStore](../../apps/api/src/modules/auth/stores/prisma-session.store.ts) persists sessions and checks active user state; database-backed sessions are favorable for replicas, not proof of complete multi-instance auth. [main.ts](../../apps/api/src/main.ts) enables shutdown hooks; Prisma disconnects and Redis shuts down. Verify in-flight requests, revocation, stable secret/config compatibility and graceful shutdown under two processes.
- **P2 / #316 — process-local metrics:** [HttpMetricsRegistry](../../apps/api/src/common/http-metrics/http-metrics.registry.ts) explicitly holds per-process fixed-cardinality counters/histograms. Scrape each instance and aggregate rates rather than scraping a load-balanced endpoint. [HealthController](../../apps/api/src/infra/health/health.controller.ts) already distinguishes live and dependency readiness. No new telemetry stack without a measured gap.
- **P1 / #351 and #923 — deployment:** [production Compose](../../infra/docker/compose.prod.yaml) explicitly describes single-instance API, a local avatar volume, loopback fixed port and separate migration service. It is not a multi-host deployment spec. Keep single-instance baseline until routing, secrets, shared storage, DB/Redis and rolling migration/restore tests are verified. No production access or deployment in SA01.

## Reproduce and complete the inventory

Run in an isolated checkout of the pinned commit with the locked dependencies installed. Do not check out over uncommitted work or run against production databases.

```sh
git rev-parse HEAD
git ls-files 'apps/api/src/modules/**/*.ts' | wc -l
git ls-files 'apps/api/src/modules/*/*.module.ts'
pnpm --filter @gym/api architecture:check
pnpm --filter @gym/api architecture:deps
pnpm --filter @gym/api test:architecture
pnpm architecture:cruise
pnpm architecture:cruise:named
pnpm architecture:cruise:relative
pnpm architecture:cruise:boundaries
git grep -nE '@(Cron|Interval|Timeout)\(' -- apps/api/src
```

Export the existing Dependency Cruiser graph for review (outside the repository); keep the existing TypeScript AST guard authoritative for Nest alias/type-only/DI rules:

```sh
pnpm exec depcruise --config .dependency-cruiser.cjs \
  --include-only '^apps/api/src/' --output-type json \
  apps/api/src > /tmp/ovranto-api-dependency-graph.json
```

Use the existing parser for a one-off inventory rather than adding a second checker. From the repository root, after locked installation, export all cross-feature alias imports, with runtime/type-only classification, then review relative paths and computed imports using the existing guards. The command does not modify the tracked tree.

```sh
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseModuleImports } from './apps/api/scripts/import-parser.mjs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((p) => /^apps\/api\/src\/modules\/[^/]+\/.*\.[mc]?ts$/.test(p))
  .filter((p) => !p.split('/').includes('test'));
const edges = new Map();
for (const file of files) {
  const source = file.split('/')[4];
  for (const item of parseModuleImports(readFileSync(file, 'utf8'), file)) {
    const target = /^#src\/modules\/([^/]+)\//.exec(item.path ?? '')?.[1];
    if (!target || source === target) continue;
    const kind = item.typeOnly ? 'type-only' : 'runtime';
    const key = [source, target, kind].join(' -> ');
    const edge = edges.get(key) ?? { source, target, kind, imports: 0 };
    edge.imports++;
    edges.set(key, edge);
  }
}
console.log(JSON.stringify([...edges.values()].sort((a, b) =>
  (a.source + a.target + a.kind).localeCompare(b.source + b.target + b.kind)
), null, 2));
NODE
```

This is an alias-edge report, not a replacement analyzer. Review type-only and runtime totals separately; reconcile relative/dynamic imports, tests, common/infra and shared packages with the existing checks. Capture the actual complete output and verified test status in this document before claiming SA01 complete.

## Delivery sequence

- #909: current open #914 (controller ownership), drafts #915 (Dependency Cruiser), #916 (coverage), #917 (Admin Users read boundary). Their changed paths do not overlap this document or the architecture index. No parallel ABI implementation.
- #918: finish exhaustive graph and process-state inventory on pinned checkout; reconcile current main and CI. Keep issue open.
- #919/#920: narrow facade pilot and inner-layer policy after baseline, preserving ADR-007 scope. #293/#290 own security-critical transitions.
- #921/#922: storage contract and connection budget. #923 follows with replica evidence. #568/#569 stay canonical for async processing; #351/#352 retain release gates.
- #924: minimal generators after boundary policy. Existing #370, #313–316, #711, #335/#374 own package, perf and tooling work.

## Verification status

Pinned main push [CI](https://github.com/sauron9521/gym-platform/actions/runs/45807130792) and [Web / Integration E2E](https://github.com/sauron9521/gym-platform/actions/runs/45807130797) report success. This does not prove the full AST graph, two-instance runtime or new PR checks. Remote workstation unavailable; no local formatter, architecture command, tests or load run executed during this review. The source inventory, direct registration graph and listed examples are verified through GitHub; exhaustive export and new PR CI remain pending. Do not close #918 until its full acceptance is evidenced and the owner manually merges.
