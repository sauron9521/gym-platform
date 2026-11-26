# ADR-010 — ABI06b4a Workout analytics boundary inventory

- **Baseline:** [main ab52abd](https://github.com/sauron9521/gym-platform/commit/ab52abd2b8531da62dfb85a0efa652e54d921df3), after #951 merged.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md).
- **Scope:** prepare explicit public application contracts; the controller remains in WorkoutAnalyticsModule.

## Routes and consumers

| Method and path                                            | Operation ID                               | Success | IP/min |
| ---------------------------------------------------------- | ------------------------------------------ | ------: | -----: |
| GET /workout-analytics/summary                             | WorkoutAnalyticsController_summary         |     200 |     20 |
| GET /workout-analytics/personal-records                    | WorkoutAnalyticsController_personalRecords |     200 |     20 |
| GET /workout-analytics/exercises/:exerciseId/previous-sets | WorkoutAnalyticsController_previousSets    |     200 |     20 |
| GET /workout-analytics/exercises/:exerciseId               | WorkoutAnalyticsController_exercise        |     200 |     20 |

All four operations use ordinary cookie/bearer authentication and the existing analytics rate policy. Previous sets retains explicit no-store and a strict empty query. Proposed Athlete ownership follows current athlete capability checks, not a new role guard. Web dashboard volume and personal-record widgets consume summary and personal-records; Mobile progress queries consume summary and exercise history, and active workout previous-set hints consume previous-sets. Keep these generated API-client contracts and behavior stable.

## Application and actor contracts

[public-api.ts](../../apps/api/src/modules/workout-analytics/public-api.ts) exports the existing WorkoutAnalyticsService, three input schemas, the query and actor types, and four existing response schemas. The module exports only the existing service instance. Its repository, SQL row types, range constants and UTC helper remain private.

[Workouts public-api](../../apps/api/src/modules/workouts/public-api.ts) adds a type-only re-export of the exact existing WorkoutActor. It retains the existing canonical assertWorkoutAthlete policy as its sole runtime export. Analytics re-exports the actor type so the future HTTP adapter needs only its own feature contract. No duplicate identity model, runtime Workouts dependency or cross-audience exception is introduced. The analytics service also consumes the already-exported UsersService through the [Users public contract](../../apps/api/src/modules/users/public-api.ts). UsersModule remains its only provider owner and the sole existing feature module import of WorkoutAnalyticsModule.

Each service operation loads current persisted account capabilities before reading history and applies the existing assertWorkoutAthlete assertion; stale token roles do not grant access. Legacy TRAINER identities retain personal Athlete capabilities; admins and accounts without athlete capability are denied. Queries are owner-scoped and never accept arbitrary user IDs. Preserve completed-only workout/set selection, historical exercise snapshots, actual strength volume and best weight, lifetime distinct exercise record count, UTC aggregation, 90-day latest-occurrence previous sets with ordered set positions, null/zero behavior and existing repeatable-read transaction. Unknown or inaccessible exercise IDs retain the same empty history response. No SQL, calculation or policy changes.

Boundary tests verify exact provider and schema identities, actor type compatibility and strict query owner-input denial. The adapter tests cover all four delegations, including personal records. A test-only consuming Nest module verifies singleton service/repository and UsersService ownership, without moving the controller.

## Next slice

ABI06b4b moves the entire controller and its adapter spec into AthleteWorkoutAnalyticsApiModule, composed by the existing AthleteApiModule. Preserve class and handler names, paths, status, no-store, response schema and stock throttle keys. The frozen migration inventory includes the original controller and spec: add exactly their historical relocation entries, retain the historical core registry, and do not modify the inventory or validator. Add the athlete manifest and zero core controllers; verify actual Nest ownership, canonical contract parity, real HTTP owner/capability isolation and architecture/tooling. No application policy, dependency version, persistence or deployment changes. Follow with ABI06b cumulative review before the next migration group.

## ABI06b4b Athlete API relocation

[AthleteWorkoutAnalyticsApiModule](../../apps/api/src/api/athlete/workout-analytics/athlete-workout-analytics-api.module.ts) composes the complete [WorkoutAnalyticsController](../../apps/api/src/api/athlete/workout-analytics/controllers/workout-analytics.controller.ts) under AthleteApiModule. Only its public-contract import changes. The core registers zero controllers and retains its original UsersModule dependency, sole service export and private repository. The athlete manifest and exact historical controller/spec mappings preserve architecture and migration evidence; the historical core registry remains at its original path. The leaf registry pins all four original routes, authentication metadata, handler identity, 20/min stock throttling and the previous-sets no-store header. Real Nest composition pins the sole controller and provider owners. Existing HTTP regressions preserve legacy TRAINER compatibility, owner isolation, previous-set hints and actual completed history; no new role gate.

All four analytics routes are audience-owned. Follow with cumulative ABI06b review before ABI06c. No authorization, SQL, persistence, dependency version or deployment changes.
