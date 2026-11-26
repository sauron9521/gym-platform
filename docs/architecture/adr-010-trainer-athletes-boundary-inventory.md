# ADR-010 — ABI06c1 TrainerAthletes boundary inventory

- **Baseline:** [main bd1a344](https://github.com/sauron9521/gym-platform/commit/bd1a3448cabb528aa3e75084528ac665db3ee454), after #955.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06b review](adr-010-abi06b-migration-review.md).
- **Scope:** contract and dependency preparation. Both controllers remain in TrainerAthletesModule.

## Routes and consumers

| Method and path                                     | Operation ID                              | Audience | Success | IP/min |
| --------------------------------------------------- | ----------------------------------------- | -------- | ------: | -----: |
| POST /trainer-athletes                              | TrainerAthletesController_create          | Shared   |     201 |     10 |
| GET /trainer-athletes                               | TrainerAthletesController_findMany        | Shared   |     200 |     60 |
| GET /trainer-athletes/:id                           | TrainerAthletesController_findOne         | Shared   |     200 |     60 |
| POST /trainer-athletes/:id/accept                   | TrainerAthletesController_accept          | Shared   |     200 |     10 |
| POST /trainer-athletes/:id/decline                  | TrainerAthletesController_decline         | Shared   |     200 |     10 |
| POST /trainer-athletes/:id/cancel                   | TrainerAthletesController_cancel          | Shared   |     200 |     10 |
| POST /trainer-athletes/:id/terminate                | TrainerAthletesController_terminate       | Shared   |     200 |     10 |
| GET /trainer-dashboard/overview                     | TrainerDashboardController_overview       | Trainer  |     200 |     60 |
| GET /trainer-dashboard/clients/:relationId/progress | TrainerDashboardController_clientProgress | Trainer  |     200 |     60 |

All routes retain ordinary cookie/bearer authentication, original Swagger tags and operation identities, existing request/response validation and read/default rate budgets. Web relationship list/actions support both participants, Mobile queries consume relationship routes, and Trainer Web consumes the scoped relationship list and dashboard reads. Preserve these contracts, including the optional trainer scope filter; no new role gate or URL prefix.

## Public boundary and dependencies

[TrainerAthletes public-api](../../apps/api/src/modules/trainer-athletes/public-api.ts) exports exactly the existing TrainerAthletesService and TrainerDashboardService, actor type, four request schemas and corresponding DTO types, and two existing dashboard response schemas. Relationship response schemas already live in the shared OpenAPI contracts and are unchanged. Dashboard response definitions move unchanged from the controller to [trainer-dashboard.responses.ts](../../apps/api/src/modules/trainer-athletes/trainer-dashboard.responses.ts). Both legacy controllers and adapter tests consume the public boundary. The module adds only the existing dashboard provider to exports. Repositories, termination and exercise-copy services, selectors and policies remain private.

Exercises, Workouts and TrainingPrograms now import the already-exported TrainerAthletesService through its public contract, not the service implementation path. Exercises and Workouts use getExerciseAccessContext; TrainingPrograms uses findOne for relationship validation. The existing [Exercises public-api](../../apps/api/src/modules/exercises/public-api.ts) adds a type-only re-export of the exact ExerciseAccessContext; TrainerAthletes consumes it without introducing a runtime Exercises import or module dependency. TrainerAthletes and TrainerDashboard services consume the existing UsersService public contract. UsersModule remains the sole feature module dependency of TrainerAthletesModule. No duplicated actor/visibility policy, new provider instance or circular Nest module imports.

## Invariants to retain

- Invitation direction is derived from current persisted capabilities of both participants. The repository rechecks current eligibility before insertion; preserve rejection of ambiguous/self invitations and duplicate open pairs.
- Accept/decline are recipient-only; cancel is initiator-only. Current capability, participant and lifecycle checks remain server-owned. A revoked trainer may still close a relationship through the restricted projection without gaining contact information or new trainer permissions. Preserve status/error behavior, query pagination and redacted projections.
- Termination claims the ACTIVE transition, ends associated active program assignments, creates relevant private athlete-owned exercise copies, revokes assignments and trainer access and returns the permitted projection in one existing transaction. No split transaction or mutation rewrite.
- Dashboard reads require current trainer approval and deny admins. Overview and client progress retain fixed bounded PostgreSQL reads, owned programs and current active relationships, the existing 30-day window and minimal fields. Client progress uses relationId, not athlete ID; foreign, ended and unavailable relationships have identical not-found behavior.
- Exercise access context and assignment validation preserve current capability and transaction-level rechecks in consuming features. No client-supplied actor identity.

Exact export and type identity tests, strict input checks and actual Nest consumer probes verify both service instances, unique private providers and both existing controller owners. The original relationship, dashboard, termination, exercise and assignment regressions remain relevant to this contract change.

## Next slices

ABI06c2 moves the complete seven-operation relationship controller and its adapter spec into SharedTrainerAthletesApiModule, preserving method/class identity and all metadata. Add a shared manifest for partial migration; the core still owns TrainerDashboardController, and the legacy registry test must explicitly retain dashboard coverage. Frozen inventory contains the relationship controller and spec: add exact relocation entries; keep its registry in place.

ABI06c3 introduces TrainerApiModule and TrainerDashboardApiModule (using the required trainer-trainer-athletes-api.module.ts naming convention) with the actual two-operation dashboard controller and adapter spec. Recheck frozen membership; dashboard files were absent from the frozen source inventory at this baseline. Add trainer to the audience manifest and explicitly empty core controllers. Preserve current approval checks and bounded projections. Finish with ABI06c4 cumulative parity review. No new policy, schema, dependency version or deployment changes.

## ABI06c2 Shared relationship relocation

[SharedTrainerAthletesApiModule](../../apps/api/src/api/shared/trainer-athletes/shared-trainer-athletes-api.module.ts) composes the entire [TrainerAthletesController](../../apps/api/src/api/shared/trainer-athletes/controllers/trainer-athletes.controller.ts) under SharedApiModule. Only the public-contract import changes. Preserve all seven method/class identities, validation, ordinary authentication, read and default rate budgets, and response/status contracts. The core retains its original private providers, both service exports and only the legacy dashboard controller. A shared audience manifest describes partial migration. Exactly two historical controller/spec mappings are added; the frozen inventory and validator stay unchanged. The original registry explicitly pins both legacy dashboard operations, and the new Shared registry and real Nest composition tests pin sole ownership and unchanged providers.

No modification to the invitation, termination, exercise-copy, access-revocation or dashboard logic. The next slice ABI06c3 creates the actual Trainer API composition and moves the two dashboard operations, leaving a controller-free core.

## ABI06c3 Trainer dashboard relocation

[TrainerApiModule](../../apps/api/src/api/trainer/trainer-api.module.ts) composes its first real feature leaf, [TrainerTrainerAthletesApiModule](../../apps/api/src/api/trainer/trainer-athletes/trainer-trainer-athletes-api.module.ts), which owns the complete [TrainerDashboardController](../../apps/api/src/api/trainer/trainer-athletes/controllers/trainer-dashboard.controller.ts). The leaf follows the existing audience/feature naming convention. Only the public-contract import changes. Preserve both original read-only operations, authentication, 60/min stock throttling, response metadata and capability-checked service behavior. Shared retains seven relationship operations. The core registers zero controllers and retains both service exports, all private providers and the single UsersModule dependency. Manifest declares shared and trainer. Dashboard controller and spec were not in the frozen inventory; no additional historical relocation entries are needed. The original registry remains in place and now pins an empty core. The new leaf registry and real Nest composition tests verify sole ownership. Existing HTTP regressions verify approved and revoked trainers, admin/athlete denial, foreign/ended relationship privacy, and bounded dashboard counts.

All nine operations are now audience-owned. Follow with cumulative ABI06c review before Exercises. No policy, persistence, dependency or deployment changes.

The [ABI06c cumulative review](adr-010-abi06c-migration-review.md) records final merged evidence and the next Exercises sequence.
