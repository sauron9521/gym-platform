# ADR-010 — ABI06d1 Exercises boundary inventory

- **Baseline:** [main 814bfdc](https://github.com/sauron9521/gym-platform/commit/814bfdc14bc74799e1b65b5734ef08bf1a9a6041), after #997.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06c review](adr-010-abi06c-migration-review.md).
- **Scope:** refresh the migration baseline and prepare the Exercises public contract. Both controllers remain in ExercisesModule.

## Main reconciliation

The previous ABI06c review recorded 85 paths and 107 operations. Current main has 95 paths and 117 unique operations. Five new Shared notification inbox operations (#966) and five new Admin inbox operations (#972) are already audience-owned; the two notification settings operations also changed through the notification feature work. No original method/path was removed. All ten existing Exercises operations compare equal to the previous review baseline. The new notification outbox, delivery and retention, datetime package, mail and database timing changes are independent work retained unchanged. Do not revert these changes or use the old 107-operation count as the current contract baseline.

The present audience-owned count is 69/117. The remaining 48 consist of Exercises (10), Workouts (10), TrainingPrograms (26) and Health (2). The operational health routes require a separate composition decision, not an arbitrary audience move. Core organization remains deferred until all architecture migration stages finish as recorded in #964.

## Routes and audience ownership

| Method and path                                 | Operation ID                           | Proposed audience      | Success | IP/min |
| ----------------------------------------------- | -------------------------------------- | ---------------------- | ------: | -----: |
| GET /exercises                                  | ExercisesController_findMany           | Public (optional auth) |     200 |     60 |
| GET /exercises/muscle-groups                    | ExercisesController_listMuscleGroups   | Public (optional auth) |     200 |     60 |
| GET /exercises/equipment                        | ExercisesController_listEquipment      | Public (optional auth) |     200 |     60 |
| GET /exercises/:id                              | ExercisesController_findOne            | Public (optional auth) |     200 |     60 |
| POST /exercises                                 | ExercisesController_create             | Shared                 |     201 |     10 |
| PATCH /exercises/:id                            | ExercisesController_update             | Shared                 |     200 |     10 |
| DELETE /exercises/:id                           | ExercisesController_archive            | Shared                 |     200 |     10 |
| GET /exercises/:id/trainer-access               | ExerciseTrainerAccessController_list   | Athlete                |     200 |     10 |
| POST /exercises/:id/trainer-access              | ExerciseTrainerAccessController_grant  | Athlete                |     200 |     10 |
| DELETE /exercises/:id/trainer-access/:trainerId | ExerciseTrainerAccessController_revoke | Athlete                |     204 |     10 |

All operations retain the Exercises Swagger tag. Catalog reads are optional-authenticated, not anonymous-only: list and detail derive the current relationship context for an authenticated actor; guests get the existing empty context. Static taxonomy routes precede UUID detail. Mutations retain default mandatory authentication and their current authorization/scope logic; grants retain explicit ordinary authentication. Web consumes list/detail/taxonomy and mutation routes, Mobile consumes the catalog list. Workouts and TrainingPrograms consume internal exercise application services through Nest DI. Do not change public paths, request schemas, response metadata, cache behavior or rate keys.

## Application contract

[Exercises public-api](../../apps/api/src/modules/exercises/public-api.ts) retains the exact canonical visibility predicate, workout reference select and ExerciseAccessContext type. It adds the two existing application services, ExerciseActor type and the six existing request/ID schemas and DTO types needed by the adapters. The existing ExercisesService export remains; the already registered ExerciseTrainerAccessService becomes the second module export. Both repositories remain private. Controllers and adapter specs consume the public contract. Workouts and TrainingPrograms use the existing service through that contract, and Workouts uses the exact re-exported actor type. ExercisesService uses the existing Users public contract. No extra provider, module import or duplicated visibility policy is introduced. Existing service implementations differ only by imports.

The catalog controller currently consumes TrainerAthletesService through its existing public contract. When extracting the read adapter, preserve that dependency explicitly (or use a separately reviewed narrow exercise read facade if justified by composition); Nest module exports are not transitive. Do not expose private providers or trust client-supplied access context. The existing ExercisesModule imports TrainerAthletesModule and UsersModule.

## Preserve invariants

- Guest and Admin catalog reads remain global-only, with no implicit permission to read private personal content. Authenticated reads preserve owner visibility, explicit active trainer access, archived filtering and live relationship rechecks in the SQL predicate.
- Create/update/archive retain persisted capability and creation-scope rules, including locked write rechecks, explicit ATHLETE/TRAINER scope and legacy behavior. Archive is not hard deletion; preserve historical workout references.
- Grant/list/revoke retain current ATHLETE actor restriction, owner lookup, selected-trainer visibility and active relationship checks; a stale grant must not authorize reads. Keep repository and transaction boundaries unchanged.
- Workout creation retains the original minimal reference projection and canonical visibility policy in its transaction. Program editing retains the existing independently checked Trainer capability.

New tests pin exact service/schema/actor identities, strict owner/context input rejection, existing controller and provider metadata, real Nest singleton resolution of both exported services and unique repository/relationship/Users owners. Existing real HTTP and transaction regressions remain the acceptance evidence.

## Next slices

Continue the [ABI06c review](adr-010-abi06c-migration-review.md) sequence: d2 moves the three Athlete grant operations, d3 stabilizes mixed-controller operation identities before a split, d4 moves four optional-auth public reads, d5 moves three Shared mutations, d6 reviews the cumulative result. Both original controllers and their adapter specs are in the frozen inventory; map only exact moved historical files. Keep the original registry and verify partial/full ownership. No SQL, schema, dependency, security policy or deployment changes in d1.
