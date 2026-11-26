# ADR-010 — ABI06b migration review

- **Decision:** technical PASS for the reviewed transport migration; recommend limited continuation to ABI06c preparation. This is not a security certification or Beta/production authorization.
- **Baseline:** [main b09b2cc](https://github.com/sauron9521/gym-platform/commit/b09b2ccaaa12f2afcc35ef8fac5ba12d64edc5ac), after #944.
- **Reviewed main:** [3aaf76d](https://github.com/sauron9521/gym-platform/commit/3aaf76d60744e4c3428e448db025222dd7a00534), after #954.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md).

## Merged evidence

All eight PRs are merged. Both CI and Web Integration E2E concluded successfully on each final PR head. The workflow links refer to those exact heads, not later branches.

| PR                                                          | Scope                     | Merge   | CI                                                                          | Web integration                                                             |
| ----------------------------------------------------------- | ------------------------- | ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [#945](https://github.com/sauron9521/gym-platform/pull/945) | Notifications contracts   | c2270c9 | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45882644625) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45882644692) |
| [#946](https://github.com/sauron9521/gym-platform/pull/946) | Shared notifications      | 21fd9fc | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45883564516) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45883564433) |
| [#947](https://github.com/sauron9521/gym-platform/pull/947) | Deletion intake contracts | 04884c8 | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45884660144) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45884660326) |
| [#949](https://github.com/sauron9521/gym-platform/pull/949) | Shared deletion intake    | de2ff97 | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45886220524) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45886220542) |
| [#950](https://github.com/sauron9521/gym-platform/pull/950) | Measurement contracts     | 05367b2 | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45887197732) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45887197830) |
| [#951](https://github.com/sauron9521/gym-platform/pull/951) | Athlete measurements      | ab52abd | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45888143505) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45888143389) |
| [#952](https://github.com/sauron9521/gym-platform/pull/952) | Analytics contracts       | 8062ae5 | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45889213496) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45889213452) |
| [#954](https://github.com/sauron9521/gym-platform/pull/954) | Athlete analytics         | 3aaf76d | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45890241022) | [PASS](https://github.com/sauron9521/gym-platform/actions/runs/45890240984) |

Final #954 jobs passed both PostgreSQL shards and aggregate, critical coverage, Admin cookie/proxy browser E2E, Web fixture browser shards, Docker, signed staging contracts, migration inventory/cutover NO-GO, verified release NO-GO, operations, observability, tooling, quality, Windows Metro and all four real Web integration shards. Dependency vulnerability audit, monitoring shadow, Landing browser and Windows pre-push jobs were skipped. A successful workflow does not mean those skipped checks ran.

## Cumulative acceptance

| Feature                                                                     | Audience | Operations | Boundary evidence                                                                     |
| --------------------------------------------------------------------------- | -------- | ---------: | ------------------------------------------------------------------------------------- |
| [Notifications](adr-010-notifications-boundary-inventory.md)                | Shared   |          2 | Consent, quiet hours, strict input, atomic writes and private settings.               |
| [Account deletion requests](adr-010-account-deletion-boundary-inventory.md) | Shared   |          2 | Owner receipt, credential confirmation and distributed quota; intake only.            |
| [Body measurements](adr-010-body-measurements-boundary-inventory.md)        | Athlete  |          6 | Private measurement and statistics use cases; legacy TRAINER owner access preserved.  |
| [Workout analytics](adr-010-workout-analytics-boundary-inventory.md)        | Athlete  |          4 | Persisted capability checks, owner-scoped completed history and previous-set privacy. |

- **HTTP contract:** full canonical OpenAPI JSON deep equality across both pinned commits: 85 paths, 107 unique operation IDs, all 14 selected operations unchanged. Generated TypeScript AST equality after sorting interface members and declarations; regenerated artifacts match reviewed main byte-for-byte.
- **Controller behavior:** all four controller class ASTs (decorators, method names, bodies and types) equal after printing without comments. Original stock throttler keys remain stable. No added role restriction; audience ownership is organizational.
- **DI and dependencies:** the real application probes confirm one controller owner per feature, zero core controllers, one existing service/repository owner, unique UsersService and rate storage. Each core exports only the documented service(s); all repositories stay private. AthleteApiModule has two real leaves. Analytics uses the existing Users public contract and the unchanged Workouts policy, with a type-only actor re-export; its service differs from baseline only by imports.
- **Persistence and historical evidence:** no changes to the checked Prisma schemas/migrations, API package manifest, lockfile, frozen inventory or relocation validator, Auth/Users modules, common auth/audit, rate policies, Workouts policies or four features' existing repositories, domain, DTO, utils, types and selects. The first three feature services are unchanged. Relocation map equals the baseline plus exactly four required historical controller/spec entries for measurements and analytics; no other mapping changes.
- **Security:** PASS for preserved tested behavior, not for an expanded authorization policy. Account deletion MFA test proves enrolled-account HTTP denial and real TOTP service verification with test-only enabled verifier. Successful production HTTP confirmation for enrolled accounts is not demonstrated. See [#948](https://github.com/sauron9521/gym-platform/issues/948). No activation of global MFA or execution of deletion.

### Fresh validation

Reran 83 selected PostgreSQL/Redis tests across nine files: Users 26, application composition 12, OpenAPI 6, Notifications API 10, notification preferences 4, account deletion MFA 1, distributed throttling 5, measurements 10 and workout analytics 9. All passed. Fresh canonical regeneration, architecture/dependency checks, Dependency Cruiser, 114 architecture tests and 11 coverage tooling tests passed. The documentation-only review runs docs:check and root tooling as well. The existing pg concurrent-query deprecation warning was observed during Notifications E2E; no driver or query change is included. Disposable PostgreSQL, Redis and avatar storage were isolated and removed.

Prior #954 local evidence includes 1,975 API unit tests, coverage thresholds, 424 root tooling tests and 63 selected PostgreSQL tests; this is historical evidence, not a fresh full API test rerun in the review. Full Web/API CI evidence comes from the merged slice workflows. No production readiness or performance claim.

## Remaining risks and recommendations

- [#948](https://github.com/sauron9521/gym-platform/issues/948) and [#290](https://github.com/sauron9521/gym-platform/issues/290) remain open P0 security work; preserve existing fail-closed behavior and resolve policy before the relevant rollout. The migration does not authorize deletion execution or expanded Admin access.
- [#925](https://github.com/sauron9521/gym-platform/pull/925) remains an open draft dependency/scalability baseline. Coordinate it with #918–920 rather than duplicating analysis.
- The pg concurrent-query warning is a future compatibility concern. Investigate separately before upgrading to pg 9; do not mix a transaction/query rewrite into transport migration.
- 50 of 107 canonical operations are audience-owned after ABI06a/b and prior Users/Auth work. The remaining 57 include unmigrated feature and operational routes. Do not interpret this count as security or deployment readiness. No separate process, database or worker approved.

## ABI06c proposed next group — TrainerAthletes

Current source has nine operations in two controllers. Relationship endpoints serve both participants; do not duplicate them by audience. Dashboard endpoints require current persisted trainer approval and active owner-scoped collaboration. Existing Web and Mobile relationship consumers and Trainer dashboard consumers require identical contracts. Exercises, Workouts and TrainingPrograms consume the existing TrainerAthletesService, so prepare the cross-feature contract before moving controllers.

| Slice   | Scope                                         | Acceptance                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABI06c1 | Contract and dependency inventory/preparation | Verify current baseline and existing public contracts; define explicit compatible TrainerAthletesService and dashboard read contracts, actor and DTO/response schemas. Use existing Users public contract, resolve exercise-access context and existing consumers without circular DI or duplicated policy. Keep termination and exercise-copy services/repositories private. No controller move. |
| ABI06c2 | Shared relationships (7 operations)           | Move complete TrainerAthletesController and adapter spec; preserve both participants' current capabilities, invitation direction, recipient-only accept/decline, cancel/terminate privacy and status transitions. Register shared leaf while retaining dashboard legacy registration. Map only frozen historical files that actually move.                                                        |
| ABI06c3 | Trainer dashboard (2 operations)              | Create the first actual TrainerApiModule and leaf for TrainerDashboardController. Verify approval/revocation and foreign/ended relationship denial; preserve bounded counts and identical not-found projection. Complete zero-core-controller manifest and unique DI.                                                                                                                             |
| ABI06c4 | Cumulative review                             | Compare all nine operations, class/handler/metadata parity, existing consumer contracts, private projections, atomic transaction and concurrent transition behavior, full CI/Web and real HTTP/database regressions.                                                                                                                                                                              |

The existing termination transaction changes the active relationship, terminates active program assignments, copies relevant trainer exercises privately and revokes exercise assignments/access in one transaction. Preserve that boundary and concurrent winner behavior; do not split it by audience or rewrite it during this work. Review its implementation separately if new invariants or scaling evidence warrant it. Retain the frozen relationship registry test and add exact controller/spec mappings for the frozen relationship controller and spec; verify dashboard file membership before mapping. Do not start Exercises or larger Workouts/TrainingPrograms migrations until the next review.

[ABI06c1 TrainerAthletes boundary inventory](adr-010-trainer-athletes-boundary-inventory.md) records the next preparation slice.

This is a documentation-only review and a recommendation to continue the approved incremental architecture direction; each implementation slice still requires its own verified PR and manual merge.
