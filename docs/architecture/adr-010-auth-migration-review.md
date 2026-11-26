# ADR-010 — ABI05e Auth migration review

- **Reviewed:** 2026-11-26, [main 3e22513](https://github.com/sauron9521/gym-platform/commit/3e2251370702a5e65d387b458df27d1fccc2217b).
- **Pre-Auth baseline:** [main fa8ad3a](https://github.com/sauron9521/gym-platform/commit/fa8ad3a9e78dbf5e27dfe6e0d6714cf8d2356cd8).
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [Auth boundary inventory](adr-010-auth-boundary-inventory.md), [Users pilot review](adr-010-users-pilot-review.md).
- **Recommendation:** technical PASS for the completed Auth migration, limited GO recommended for ABI06 after review and manual merge of this evidence record. No separate process, Beta, production or new security-policy authorization.

## Merged evidence

| Slice                          | PR                                                          | CI                                                                          | Web Integration E2E                                                         |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ABI05a inventory               | [#930](https://github.com/sauron9521/gym-platform/pull/930) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45849956090) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45849956092) |
| ABI05b1 stable HTTP identities | [#931](https://github.com/sauron9521/gym-platform/pull/931) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45851619997) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45851619939) |
| ABI05b2 Admin session facade   | [#932](https://github.com/sauron9521/gym-platform/pull/932) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45853164867) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45853164818) |
| ABI05b3 public contracts       | [#933](https://github.com/sauron9521/gym-platform/pull/933) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45854465455) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45854465458) |
| ABI05c1 password reset         | [#934](https://github.com/sauron9521/gym-platform/pull/934) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45855858440) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45855858480) |
| ABI05c2 tokens                 | [#935](https://github.com/sauron9521/gym-platform/pull/935) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45857415674) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45857415668) |
| ABI05d1 email                  | [#936](https://github.com/sauron9521/gym-platform/pull/936) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45858894788) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45858894505) |
| ABI05d2 login                  | [#937](https://github.com/sauron9521/gym-platform/pull/937) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45860570025) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45860570186) |
| ABI05d3a Admin sessions        | [#938](https://github.com/sauron9521/gym-platform/pull/938) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45862044831) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45862044882) |
| ABI05d3b ordinary sessions     | [#939](https://github.com/sauron9521/gym-platform/pull/939) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45863817207) | [Pass](https://github.com/sauron9521/gym-platform/actions/runs/45863817106) |

All ten PRs were verified merged and both workflows completed successfully at their final heads. The final slice CI includes both PostgreSQL E2E shards, aggregate API E2E, critical coverage, Admin browser cookie/proxy, quality, vulnerability audit, API observability, Docker, source inventory and release/cutover NO-GO checks. All four real Web Integration E2E shards passed. Monitoring shadow was skipped; no fresh validation for that job is implied. NO-GO checks succeeding do not authorize deployment. Prior slice #939 recorded 1,941 unit tests, 424 root tooling tests, 114 architecture tests, 11 coverage tooling tests and 90 selected PostgreSQL/Redis E2E tests; those are historical slice results, not new full-suite executions in this review.

## Cumulative acceptance

| Area                   | Finding                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership              | PASS: AuthModule explicitly registers zero controllers. Nine HTTP controllers are distributed among Public (5 controllers, 9 operations), Shared (2 controllers, 4 operations) and Admin (2 controllers, 4 operations). No legacy production controllers directory.                                                                    |
| HTTP contracts         | PASS: deep equality of the complete tracked OpenAPI JSON between the pinned baseline and reviewed main. All 85 paths and 107 operations match, with unique operation IDs; all 17 Auth legacy operation IDs/tags have one audience owner. Generated client TypeScript AST interfaces match with declaration/member ordering normalized. |
| Dependencies           | PASS: three leaves consume AuthModule and public-api; no direct database import, cross-audience or inward dependency. Four injected core exports only; stores, generic account throttle, raw Admin cookie issuer and MFA internals remain private.                                                                                     |
| Registry and lifecycle | PASS for exercised single-process composition: existing runtime ownership tests and the new cumulative registry regression verify exact provider order, handlers, storage sources and nine controller owners. Cleanup provider ownership remains in AuthModule.                                                                        |
| Persistence and policy | PASS: cumulative diff leaves Prisma schemas/migrations, API package manifest, lockfile, frozen source inventory and its validator unchanged. Auth stores, credential providers, mailers, Admin MFA services, cookie issuer, generic account throttle and cleanup implementations unchanged.                                            |
| Security behavior      | PASS for exercised regression scope: Admin cookie-only access, purpose/origin/CSRF, role and permissions, isolation, pending/malformed MFA, recovery-grant restrictions, scoped revocation, session expiry, email and token flows. No comprehensive security certification or new mandatory MFA policy.                                |
| Abuse and cache policy | PASS: all 17 operations use stable legacy identities, the route decorators preserve existing budgets, the Redis cross-name regression proves the original bucket survives a rename, and no-store is exercised including early errors.                                                                                                  |
| Tooling                | PASS: architecture checks, dependency graph, 114 architecture tests and 11 coverage tooling tests rerun; the final review includes documentation and root tooling gates.                                                                                                                                                               |

### Ownership of all Auth routes

| Owner               | Controller                        | Routes                                                                                   |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| PublicAuthApiModule | AuthController                    | POST /auth/register, POST /auth/login                                                    |
| PublicAuthApiModule | PasswordResetController           | POST /auth/password-reset/forgot, POST /auth/password-reset/reset                        |
| PublicAuthApiModule | TokensController                  | POST /auth/token, POST /auth/token/refresh, POST /auth/token/revoke                      |
| PublicAuthApiModule | EmailVerificationController       | POST /auth/email/verify                                                                  |
| PublicAuthApiModule | SignOutController                 | POST /auth/sign-out                                                                      |
| SharedAuthApiModule | EmailVerificationResendController | POST /auth/email/verification                                                            |
| SharedAuthApiModule | SessionsController                | GET /auth/sessions, DELETE /auth/sessions/:id, POST /auth/sign-out-everywhere            |
| AdminAuthApiModule  | AdminAuthController               | POST /auth/admin-login                                                                   |
| AdminAuthApiModule  | AdminSessionsController           | GET /auth/admin-session, POST /auth/admin-sessions/revoke-all, POST /auth/admin-sign-out |

The audience classifies transport ownership, not authorization. Public sign-out must remain callable for pending-MFA sessions but still requires the applicable cookie. Admin login and Admin sign-out are intentional public entrypoints in the Admin audience with the existing origin check. Ordinary session list, revoke and sign-out-everywhere retain existing package scope; do not infer a new purpose filter from the folder name.

### Runtime registry regression

The added test in [admin-users E2E](../../apps/api/test/e2e/users/admin-users.e2e-spec.ts) uses public package registry accessors, not private reflection into package internals. It checks the exact provider sequence SessionAuth, JwtAuth, AdminSessionAuth by instance identity, both registered mail handlers, all four relevant storage contracts (session, refresh token, email token and MFA), exactly one global registry/storage owner, one owner for each of the nine Auth controllers and one AuthModule with zero controllers. Existing lifecycle tests and unchanged scheduled cleanup code cover cleanup provider ownership and bounded/advisory-lock behavior. This is not proof of cross-process singleton execution or production operational readiness.

## Residual risks and ABI06 recommendation

| Priority | Finding                                                                                                                                                                                    | Handling                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | [#290](https://github.com/sauron9521/gym-platform/issues/290) remains open: step-up MFA/re-auth for sensitive Admin mutations. Existing transitional password-only sessions are unchanged. | Coordinate before Trainer review or new Admin mutations; do not treat this migration as a security-policy approval.                                                   |
| P1       | Static import/registration rules do not establish complete runtime permission semantics.                                                                                                   | Require explicit route ownership and negative authorization regression for every ABI06 slice.                                                                         |
| P1       | Trainer onboarding has two mixed-audience controllers and currently exports no service.                                                                                                    | Start with dependency/security inventory and narrow feature-owned contracts; keep repositories private and verify review permissions, audit and transaction behavior. |
| P2       | SA01 [#925](https://github.com/sauron9521/gym-platform/pull/925) remains an open draft for dependency/scalability baseline.                                                                | Reconcile with the approved migration before broad feature moves; do not duplicate its scope.                                                                         |
| P2       | Feature-local DTOs, guard placement and globally configured package services are still transport/DI coupling.                                                                              | Improve only where required; no blanket abstraction, no new generic adapter framework.                                                                                |
| Later    | One Nest process and one database remain; folder isolation is not process or network isolation.                                                                                            | Measure deployment, scaling and isolation needs before a separately approved extraction.                                                                              |

Proposed ABI06 order, subject to a refreshed current-main inventory and separate owner review of slices:

1. ABI06a: Trainer onboarding/review boundary inventory and narrow public contracts; coordinate #290 and SA01 before moving the Admin review adapter, then the shared application adapter.
2. ABI06b: independently migrate lower-coupling shared/athlete features (account deletion requests, notification settings, body measurements, workout analytics) after verifying real consumers and privacy/ownership constraints.
3. ABI06c: TrainerAthletes shared relationship and trainer dashboard; retain participant-scoped reads and capability rules.
4. ABI06d: Exercises; preserve optional authentication and actor-aware private visibility, do not classify all GETs as anonymous access to private records.
5. ABI06e: Workouts and TrainingPrograms, including mixed assignment operations; verify actual athlete/trainer consumers, transaction invariants and the current ADR-007 internal contracts first.

These are planning slices, not changes already implemented or independent production approval. Re-pin main before every PR. Retain original method/path/operation IDs, rate keys, guards, transaction and audit semantics. Every moved feature must pass its own registry, canonical contracts, real database/authorization tests and CI; never weaken historical inventory or architecture gates.

## Reproduction and limitations

Use the two pinned commits for the cumulative tracked JSON and AST comparison. Compare the protected paths with git diff; confirm the original 17 operation IDs and tags exactly match the nine current controllers. Rerun architecture checks, workspace Dependency Cruiser, architecture and coverage tooling, documentation, and root tooling.

The review adds a regression test only, alongside documentation; no production code changes. Fresh canonical regeneration (byte-identical OpenAPI and client), all 30 Admin Users PostgreSQL E2E tests (including the cumulative registry regression), E2E typecheck, and Oxlint with zero warnings/errors passed. The temporary PostgreSQL container and avatar directory were isolated from development storage. Full API, Web and security regressions rely on the verified merged workflow evidence above rather than a second local full run. The audit does not replace threat modelling, penetration testing, capacity testing or the production readiness gates.
