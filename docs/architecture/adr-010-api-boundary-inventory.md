# ADR-010 — ABI02 API boundary inventory

- **Status:** Static baseline, not migration or release approval.
- **Baseline:** [main 18a6c42](https://github.com/sauron9521/gym-platform/commit/18a6c424abfe7ee6f01a83c59d507272a5a4f724).
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md).

## Route inventory

26 controller files declare 106 distinct explicit method/path pairs. The tracked OpenAPI artifact contains 84 paths and 105 operations. All 105 are matched by source declarations after normalizing colon parameters to braces; GET /internal/metrics is deliberately excluded by ApiExcludeController. Implicit Express HEAD/OPTIONS, actual runtime registration, generated schema equality and behavioral parity are not proven by this static comparison. Audience is proposed ownership, not a permission grant; mixed controllers require method-level classification and consumer verification before migration.

### Controller ownership and exact routes

Paths below are existing routes, without an invented version prefix. Each section lists the controller base and relative methods (root means the base itself).

- [http-metrics.controller](../../apps/api/src/common/http-metrics/http-metrics.controller.ts) — **Operational**; base `/internal`; `GET metrics`.
- [health.controller](../../apps/api/src/infra/health/health.controller.ts) — **Operational**; base `/health`; `GET live`, `GET ready`.
- [account-deletion-requests.controller](../../apps/api/src/modules/account-deletion-requests/controllers/account-deletion-requests.controller.ts) — **Shared**; base `/users/me/account-deletion-request`; `GET (root)`, `POST (root)`.
- [auth.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/auth/controllers/auth.controller.ts) — **Mixed public/admin**; base `/auth`; `POST register`, `POST admin-login`, `POST login`. ABI05d2 splits into [Public Auth](../../apps/api/src/api/public/auth/controllers/auth.controller.ts) and [Admin Auth](../../apps/api/src/api/admin/auth/controllers/admin-auth.controller.ts).
- [email-verification.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/auth/controllers/email-verification.controller.ts) — **Mixed**; base `/auth/email`; `POST verify` public, `POST verification` authenticated. ABI05d1 splits into [Public verification](../../apps/api/src/api/public/auth/controllers/email-verification.controller.ts) and [Shared resend](../../apps/api/src/api/shared/auth/controllers/email-verification-resend.controller.ts).
- [password-reset.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/auth/controllers/password-reset.controller.ts) — **Public**; base `/auth/password-reset`; `POST forgot`, `POST reset`. Moved in ABI05c1 to [the Public Auth API adapter](../../apps/api/src/api/public/auth/controllers/password-reset.controller.ts).
- [sessions.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/auth/controllers/sessions.controller.ts) — **Mixed shared/public/admin**; base `/auth`; `GET admin-session`, `POST admin-sessions/revoke-all`, `POST admin-sign-out`, `GET sessions`, `DELETE sessions/:id`, `POST sign-out`, `POST sign-out-everywhere`. ABI05d3a extracts [Admin Sessions](../../apps/api/src/api/admin/auth/controllers/admin-sessions.controller.ts), leaving four ordinary operations in [the legacy controller](../../apps/api/src/modules/auth/controllers/sessions.controller.ts).
- [tokens.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/auth/controllers/tokens.controller.ts) — **Public (credential/token flows)**; base `/auth/token`; `POST (root)`, `POST refresh`, `POST revoke`. Moved in ABI05c2 to [the Public Auth API adapter](../../apps/api/src/api/public/auth/controllers/tokens.controller.ts).
- [body-measurements.controller](../../apps/api/src/modules/body-measurements/controllers/body-measurements.controller.ts) — **Athlete**; base `/body-measurements`; `POST (root)`, `GET (root)`, `GET statistics`, `GET :id`, `PATCH :id`, `DELETE :id`.
- [exercise-trainer-access.controller](../../apps/api/src/modules/exercises/controllers/exercise-trainer-access.controller.ts) — **Athlete (owner-managed grants)**; base `/exercises/:id/trainer-access`; `GET (root)`, `POST (root)`, `DELETE :trainerId`.
- [exercises.controller](../../apps/api/src/modules/exercises/controllers/exercises.controller.ts) — **Mixed public/shared**; base `/exercises`; `GET (root)`, `GET muscle-groups`, `GET equipment`, `GET :id`, `POST (root)`, `PATCH :id`, `DELETE :id`.
- [trainer-athletes.controller](../../apps/api/src/modules/trainer-athletes/controllers/trainer-athletes.controller.ts) — **Shared (relationship participants)**; base `/trainer-athletes`; `POST (root)`, `GET (root)`, `GET :id`, `POST :id/accept`, `POST :id/decline`, `POST :id/cancel`, `POST :id/terminate`.
- [trainer-dashboard.controller](../../apps/api/src/modules/trainer-athletes/controllers/trainer-dashboard.controller.ts) — **Trainer**; base `/trainer-dashboard`; `GET overview`, `GET clients/:relationId/progress`.
- [trainer-applications.controller](../../apps/api/src/modules/trainer-onboarding/controllers/trainer-applications.controller.ts) — **Shared (capability onboarding)**; base `/trainer-applications`; `GET me`, `POST (root)`, `PATCH me`.
- [trainer-review.controller](../../apps/api/src/modules/trainer-onboarding/controllers/trainer-review.controller.ts) — **Admin**; base `/admin/trainer-applications`; `GET (root)`, `POST :id/approve`, `POST :id/reject`, `POST :id/revoke`.
- [training-program-assignments.controller](../../apps/api/src/modules/training-programs/controllers/training-program-assignments.controller.ts) — **Mixed athlete/trainer**; base `/training-programs`; `GET assignments`, `GET assignments/:assignmentId`, `POST assignments/:assignmentId/complete`, `POST assignments/:assignmentId/cancel`, `POST :programId/versions/:versionId/assignments`.
- [training-program-exercises.controller](../../apps/api/src/modules/training-programs/controllers/training-program-exercises.controller.ts) — **Trainer**; base `/training-programs`; `POST :programId/versions/:versionId/workouts/:workoutId/exercises`, `PATCH :programId/versions/:versionId/workouts/:workoutId/exercises/reorder`, `PATCH :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId`, `DELETE :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId`.
- [training-program-sets.controller](../../apps/api/src/modules/training-programs/controllers/training-program-sets.controller.ts) — **Trainer**; base `/training-programs`; `POST :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId/sets`, `PATCH :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId/sets/reorder`, `PATCH :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId/sets/:setId`, `DELETE :programId/versions/:versionId/workouts/:workoutId/exercises/:exerciseId/sets/:setId`.
- [training-program-versions.controller](../../apps/api/src/modules/training-programs/controllers/training-program-versions.controller.ts) — **Trainer**; base `/training-programs`; `GET :programId/versions`, `GET :programId/published-versions`, `POST :programId/versions/drafts`, `GET :programId/versions/:versionId`, `PATCH :programId/versions/:versionId`, `POST :programId/versions/:versionId/publish`.
- [training-program-workouts.controller](../../apps/api/src/modules/training-programs/controllers/training-program-workouts.controller.ts) — **Trainer**; base `/training-programs`; `POST :programId/versions/:versionId/workouts`, `PATCH :programId/versions/:versionId/workouts/:workoutId`, `DELETE :programId/versions/:versionId/workouts/:workoutId`.
- [training-programs.controller](../../apps/api/src/modules/training-programs/controllers/training-programs.controller.ts) — **Trainer (verify read consumers)**; base `/training-programs`; `POST (root)`, `GET (root)`, `GET :programId`, `DELETE :programId`.
- [admin-users.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/users/controllers/admin-users.controller.ts) — **Admin**; base `/admin/users`; `GET (root)`, `GET :userId`. Moved in ABI04b to [the Admin Users API adapter](../../apps/api/src/api/admin/users/controllers/admin-users.controller.ts).
- [avatar-public.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/users/controllers/avatar-public.controller.ts) — **Public**; base `/avatars`; `GET :key`. Moved in ABI04d to [the Public Users API adapter](../../apps/api/src/api/public/users/controllers/avatar-public.controller.ts).
- [users.controller (baseline)](https://github.com/sauron9521/gym-platform/blob/18a6c424abfe7ee6f01a83c59d507272a5a4f724/apps/api/src/modules/users/controllers/users.controller.ts) — **Shared**; base `/users`; `GET me/capabilities`, `GET me`, `PATCH me`, `PATCH me/preferences`, `GET me/preferences/workouts`, `PATCH me/preferences/workouts`, `POST me/preferences/workouts/initialize`, `POST me/avatar`, `DELETE me/avatar`. Moved in ABI04c to [the Shared Users API adapter](../../apps/api/src/api/shared/users/controllers/users.controller.ts).
- [workout-analytics.controller](../../apps/api/src/modules/workout-analytics/controllers/workout-analytics.controller.ts) — **Athlete**; base `/workout-analytics`; `GET summary`, `GET personal-records`, `GET exercises/:exerciseId/previous-sets`, `GET exercises/:exerciseId`.
- [workouts.controller](../../apps/api/src/modules/workouts/controllers/workouts.controller.ts) — **Athlete (verify trainer read consumers)**; base `/workouts`; `POST (root)`, `GET (root)`, `GET :id`, `GET :id/export`, `PATCH :id`, `POST :id/start`, `PATCH :id/sets/:setId`, `POST :id/complete`, `POST :id/cancel`, `POST from-program`.

### Mixed and privileged ownership details

- Auth: ordinary register/login, email, reset and token flows remain public transport entrypoints with existing credential checks and throttling. Admin login is a distinct privileged flow at the existing auth path; preserve AdminOriginGuard and cookie/MFA behavior.
- Sessions: admin-session and admin-sessions/revoke-all require live admin-cookie authentication, purpose and origin guards. Admin sign-out is deliberately public to permit clearing pending MFA; keep its origin guard and cookie handling. Ordinary sessions list/revoke/sign-out-everywhere remain shared; ordinary sign-out retains its public exception. Preserve no-store interceptor and exact statuses.
- Exercises: GET routes use optional authentication, not unconditional public visibility of private records; keep actor-aware repository/service checks. Writes and owner access grants retain authentication and ownership.
- Program assignments: list/detail and terminal operations are participant-scoped; assignment creation is trainer-oriented. Do not split shared reads or assign access from folder names. Verify consumers and service policy before any per-method movement.
- Admin Users: AdminSessionCookieProvider, AdminCookieRoute, origin/purpose guards, AdminUsersReadGuard after authentication, read throttling and allowed-read audit. Global permission guard ordering cannot be substituted for the route-level guard without proof.
- Trainer review: same privileged cookie/origin/purpose checks; TrainerReviewService asserts admin.accounts.manage and current admin state, repository handles decisions and conflicts, service records allowed audit. Preserve authorization/transaction behavior.
- Operational: health live/ready are operational endpoints; metrics is opt-in, token-gated and excluded from Swagger. Preserve proxy restrictions, no-store and disabled/unauthorized 404.

## Nest module and dependency inventory

The root AppModule owns bootstrap configuration, global guards/filter, request middleware, scheduler, operational metrics registration and the feature graph. The following are current direct feature imports and explicit exports (technical imports omitted except where relevant).

| Feature                   | Controllers | Direct imports                                      | Public exports                |
| ------------------------- | ----------: | --------------------------------------------------- | ----------------------------- |
| account-deletion-requests |           1 | RateLimitStorageModule                              | None                          |
| auth                      |           5 | UsersModule, RateLimitStorageModule                 | None                          |
| body-measurements         |           1 | None                                                | None                          |
| exercises                 |           2 | TrainerAthletesModule, UsersModule                  | ExercisesService              |
| trainer-athletes          |           2 | UsersModule                                         | TrainerAthletesService        |
| trainer-onboarding        |           2 | AdminAuditModule                                    | None                          |
| training-programs         |           6 | ExercisesModule, TrainerAthletesModule, UsersModule | TrainingProgramsService       |
| users                     |           3 | AdminAuditModule                                    | UsersService, UsersAuthFacade |
| workout-analytics         |           1 | UsersModule                                         | None                          |
| workouts                  |           1 | ExercisesModule, TrainerAthletesModule, UsersModule | WorkoutsService               |

The graph explains why simply moving controllers or importing existing feature modules is unsafe: feature imports currently register their controllers, and private providers are not visible to new sibling modules. Users is a high-fan-in dependency. Auth depends on Users; Exercises depends on Users and TrainerAthletes; TrainingPrograms and Workouts depend on Users, Exercises and TrainerAthletes. No new reverse dependency is allowed.

### Pilot seam and migration blockers

- UsersModule currently owns three controllers, a private UsersRepository, UsersService and UsersAuthFacade exports, AvatarService/storage/processor/cleanup, AdminAccountStatusService and admin guards. AdminUsersController directly injects UsersRepository and AdminAuditLogger. Introduce a narrow feature-owned admin read contract before moving it; do not export the repository. AvatarService requires an explicit contract if its controllers move. Keep cleanup singleton and existing audit behavior. AdminAccountStatusService is a provider, not an additional registered HTTP endpoint in this baseline.
- AuthController and SessionsController mix audiences. SessionsController directly injects PrismaSessionStore and AdminCookieAuthService; extract a narrow session operation only where needed, retaining pending-MFA logout and revocation scope. Move Auth after Users pilot review; coordinate admin MFA #290 and token cleanup ownership.
- TrainerOnboardingModule owns both ordinary application and privileged review controllers; preserve service permission checks and repository transactional decision logic before splitting.
- Notifications has a domain policy and test but no feature module/controller in this baseline. Open [PR #911](https://github.com/sauron9521/gym-platform/pull/911) adds notification settings API; do not claim its routes are already on main. Refresh inventory before modifying Users/Auth composition.

## Test and tooling inventory

Existing feature controller unit/registry tests cover the 24 feature controllers across ten feature modules; operational controllers have separate unit tests. Relevant regression suites under apps/api/test include:

- Users: users and admin-users E2E, admin-account-atomic E2E, users.repository integration, users-module-boundaries and users-controller-registry unit tests.
- Auth: auth, tokens, account-status and rate-limit E2E; auth session management, admin MFA enrollment, session/store contracts and private-api headers integration; common api-principal-isolation and csrf-trusted-origin tests.
- Trainer: trainer-applications, trainer-review, trainer-athletes E2E and trainer-onboarding schema integration.
- Exercise, program and workout: exercises/workouts E2E, published-versions E2E; exercise access/revocation, program publication/assignment and workout capability revocation integration.
- Contract and operational: infra/openapi-contracts, health and http-metrics E2E; canonical api:contract:check must prove unchanged generated schema/client after each runtime slice.

File presence is evidence of available regression entrypoints, not executed results or exhaustive authorization coverage. Add explicit runtime composition tests and verify negative admin session/permission/MFA cases per operation before expanding.

### Guardrails to adapt before moving files (ABI03)

- [check-architecture.mjs](../../apps/api/scripts/check-architecture.mjs) requires controllers directly in each feature controllers directory, a feature registration array, corresponding tests and registry tests. It will reject controller-free features today. Introduce explicit opt-in composition ownership, retaining equivalent checks for legacy and migrated paths.
- [check-feature-dependencies.mjs](../../apps/api/scripts/check-feature-dependencies.mjs) checks cross-feature imports, constructor/DI graph, public contracts and clean-layer rules; extend it to detect API-to-private-feature and reverse/API-to-API imports, without weakening current checks.
- [Dependency Cruiser](../../.dependency-cruiser.cjs) and existing parity fixtures must cover the new src/api paths and type-only/alias/relative bypass cases.
- [coverage-inventory.mjs](../../apps/api/scripts/coverage-inventory.mjs) groups feature coverage by source path. Review classification and test discovery so moved controllers do not disappear from coverage/test reports.

## Recommended next slices

1. ABI03: introduce only necessary composition/guardrail support with fixtures for legacy and migrated structures, exact single controller registration, private provider access, reverse dependencies and runtime route registration. No mass move.
2. ABI04: first add Users admin read boundary, then separate Users core and admin/shared/public adapters in small PRs. Preserve the existing route and generated schema, run unit/registry, database integration, admin E2E and principal-isolation checks. Review pilot before expansion.
3. ABI05: split Auth only after current session and MFA inventory, parallel PR reconciliation and targeted security tests.
4. ABI06 onward: Trainer review/onboarding, shared/athlete/trainer features by risk and dependencies; keep shared routes single-owned. Refresh this snapshot when relevant parallel changes merge.

No runtime, dependency, schema, generated client or deployment changes are included in ABI02.
