# ADR-010 — ABI06a4 Trainer Onboarding migration review

- **Reviewed:** 2026-11-26, [main a5d2150](https://github.com/sauron9521/gym-platform/commit/a5d2150b50a3207252c24aafc49600ef81843bd2).
- **Baseline:** [main c58729c](https://github.com/sauron9521/gym-platform/commit/c58729c30b598df519bda9261a039e702d824f92), before ABI06a1.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [Trainer Onboarding boundary inventory](adr-010-trainer-onboarding-boundary-inventory.md).
- **Recommendation:** technical PASS for TrainerOnboarding; proceed to bounded ABI06b slices after review and manual merge. No new deployment, security policy or production authorization.

## Merged evidence

| Slice                       | PR                                                          | CI                                                                          | Web Integration E2E                                                         |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ABI06a1 contracts           | [#941](https://github.com/sauron9521/gym-platform/pull/941) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45878425123) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45878425315) |
| ABI06a2 Admin review        | [#942](https://github.com/sauron9521/gym-platform/pull/942) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45879627348) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45879627361) |
| ABI06a3 Shared applications | [#943](https://github.com/sauron9521/gym-platform/pull/943) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45880595019) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45880594980) |

All three PRs were verified merged, with successful CI and Web Integration E2E at their final heads. The last slice passed both PostgreSQL E2E shards and aggregate, Admin browser cookie/proxy, critical coverage, quality, Docker, observability, migration inventory and release/cutover NO-GO checks. All four real Web integration shards passed. Dependency vulnerability audit, Windows pre-push, Landing browser E2E and monitoring shadow were skipped in #943; no fresh evidence from those jobs is claimed. Release NO-GO checks do not authorize deployment.

## Cumulative acceptance

| Area                      | Finding                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership                 | PASS: two controller classes, seven operations; Shared owns three and Admin owns four. TrainerOnboardingModule registers zero controllers; no legacy production controller directory.                                                                                                                             |
| HTTP contract             | PASS: complete canonical OpenAPI JSON deep equality between the pinned baseline and reviewed main; 85 paths, 107 unique operation IDs, seven TrainerOnboarding operations unchanged. Generated client TypeScript AST equal after declaration/member ordering normalization.                                       |
| Controller behavior       | PASS: both controller class ASTs, including decorators and method bodies, are identical to the baseline after removing comments and formatting. Class and handler names preserve stock throttler identities.                                                                                                      |
| Dependency boundary       | PASS: both leaves consume the existing public-api; exactly two core service exports and private repositories. Real Nest composition tests confirm one owner for each controller, one core, unique service/repository/audit provider ownership and route-local Admin guard resolution.                             |
| Persistence and domain    | PASS: unchanged Prisma schemas/migrations, manifests/lock, frozen inventory, relocation map and validator. DTOs, selects and applicant service/repository unchanged. Review repository/service and lifecycle only relocate the action type; emitted JavaScript matches after normalizing a trailing import comma. |
| Authorization and privacy | PASS for tested scope: ordinary authenticated owner, eligibility, strict input, safe projection; Admin cookie-only, origin/purpose guards, current Admin role and operator permission. No expansion of existing rights or independent security certification.                                                     |
| Transactions              | PASS: serializable decision behavior, identical retry and conflict handling, atomic trainer profile update/revocation, concurrent submit/reapplication and competing approve/reject (one success, one conflict).                                                                                                  |
| Audit                     | PASS for preserved behavior: existing pseudonymized logger and provider ownership; not a durable transactional compliance audit log.                                                                                                                                                                              |

### Fresh validation

Reran 40 PostgreSQL E2E/integration tests: 12 review, 10 applications, 8 application composition, 6 OpenAPI contracts and 4 onboarding schema. All passed. Canonical regeneration is byte-identical against reviewed main. Architecture checks, dependency graph, workspace Dependency Cruiser, 114 architecture tests and 11 coverage tooling tests passed. The final documentation-only PR also runs documentation and root tooling checks.

The preceding merged #943 local evidence includes 1,946 unit tests, coverage thresholds, 424 root tooling tests and 70 selected PostgreSQL E2E/integration tests. Those are historical slice results, not newly executed full suites in this review. Fresh full API/Web CI is not duplicated locally. Disposable PostgreSQL and avatar storage were isolated and removed.

## Residual risks

- [#290](https://github.com/sauron9521/gym-platform/issues/290) is still open (P0 step-up MFA/re-auth for sensitive Admin mutations); transitional legacy sessions are not changed by transport migration.
- [SA01 #925](https://github.com/sauron9521/gym-platform/pull/925) remains an open draft. Reconcile overlapping dependency and scalability work rather than duplicating it.
- Explicit audience ownership is not an authorization mechanism, process boundary or tenant isolation. Keep server-side actor, permission and transaction checks intact.
- Type-only comparisons, OpenAPI equality and tested runtime composition do not replace threat modelling, performance tests or production readiness gates.

## ABI06b refreshed plan

The earlier inventory predates notification settings; the current main contains NotificationsModule and its settings controller. The following is an initial static assessment of four remaining small feature slices, 14 operations total. Refresh the exact main and client consumers for each individual PR.

| Sequence | Feature                   | Proposed audience  | Operations | Preparation and acceptance                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------- | ------------------ | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABI06b1  | Notifications             | Shared             |          2 | Existing GET/PATCH settings on /users/me/notification-settings. Narrow NotificationSettingsService and schema/type exports; retain strict empty query, no-store, consent semantics and existing rate budgets. Verify owner isolation and atomic preference updates; move original tests without importing the private repository from the adapter. |
| ABI06b2  | Account deletion requests | Shared             |          2 | Existing GET/POST /users/me/account-deletion-request. Keep current password/TOTP confirmation, distributed per-account quota and private receipt/credential repository. Add explicit contract and DI evidence first, then move with real negative authentication and confirmation regressions. No actual deletion workflow changes.                |
| ABI06b3  | Body measurements         | Athlete (proposed) |          6 | Separate HTTP from both existing measurement and statistics services. Preserve authenticated owner scoping, validation and statistics-before-id route precedence. Verify actual consumers; retain exact historical relocation entries where required. No new role gate based on the folder name.                                                   |
| ABI06b4  | Workout analytics         | Athlete (proposed) |          4 | Preserve actor-aware owner scoping and existing analytics/previous-sets contracts. Resolve existing WorkoutActor dependency via an explicit compatible contract before moving; keep DTO and response schemas stable, no blanket cross-feature exemption.                                                                                           |

[ABI06b1a Notifications boundary inventory](adr-010-notifications-boundary-inventory.md) records the first preparation slice. Notifications first is a recommended ordering change within ABI06b: its two operations have one existing service, no direct feature-module imports and dedicated HTTP tests. Account deletion also has two operations but has additional password/MFA and distributed throttling concerns. Split preparations and controller moves where appropriate; no requirement to compress a feature into one PR. Each feature must satisfy the same controller registry, public contract, private repository, canonical schema, negative authorization, real DI, coverage and CI gates. Keep historical inventory strict. Do not start broader workout/program migration before these smaller slices are reviewed.

This review records evidence only; no production code, dependency or schema changes and no new security or release approval.
