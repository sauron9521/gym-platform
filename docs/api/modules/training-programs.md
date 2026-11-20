# Training programs module

## Assignment reads: dual capabilities and revoked trainer privacy (M05 / #291)

Both assignment list and individual GET endpoints now check the current persisted participant capabilities, not the legacy role from the session.

- The participant scope includes **both** the actor's own athlete assignments and trainer-side program assignments, even if the account is simultaneously an athlete and an approved trainer. Pagination and status filtering apply to the combined result, without duplicating rows.
- Every list page initially uses the email-free historical projection; a second SQL query returns full fields only for own-athlete assignments, regardless of assignment age, or trainer-side assignments with both a currently approved/legacy-eligible trainer and an `ACTIVE` trainer-athlete relationship.
- Both the full SQL query and the basic/detail GET SQL queries revalidate current account state and TrainerProfile approval at read time. Revocation between a capability check and SQL cannot restore email/workout details.
- Revoked trainers retain only restricted relationship/assignment identifiers and status for their own records. Current administrators and deleted participants cannot read assignments, even with stale session role claims.
- Completion and cancellation still use legacy role checks and are intentionally deferred to the next scoped PR; assignment creation already has an independent transactional capability guard.
- No Prisma migrations or API route changes.

## Live trainer capability at program assignment INSERT (M05 / #291)

`assignVersionToAthlete` already checks `TrainingProgramAccessService.assertTrainer` against the current persisted account, including approved `ATHLETE`-role trainers. Because moderation may revoke approval after that initial check, `createAssignmentForActiveRelationship` now **rechecks both parties inside its existing PostgreSQL transaction**.

The existing source-exercise → relationship → version → program lock order remains unchanged. After those checks, the transaction locks both user records in stable ID order and the trainer's optional `TrainerProfile` row (`FOR UPDATE`), then reuses `deriveAccountCapabilities` on the current user/profile snapshots. An inactive/revoked trainer, deleted account, promoted admin or otherwise ineligible athlete cannot receive a newly inserted assignment. The legacy `TRAINER` without a profile remains compatible; a revoked explicit profile overrides that legacy role. Profile revocation and assignment insertion serialize rather than racing. No schema changes or API payload changes.

**Remaining #291 scope:** migrate assignment read/list/history and completion/cancellation permissions away from `actor.role`; then #361 cross-product security matrix before Trainer Web protected routes.

**Source:** [`apps/api/src/modules/training-programs/`](../../../apps/api/src/modules/training-programs/)

Programs have versioned content. This module manages program lifecycle, versions (draft/published), workouts, exercises, sets, athlete assignments and assignment transitions. All exposed controllers advertise bearer authentication.

## HTTP route groups

- **Programs:** `POST /training-programs`, `GET /training-programs`, `GET /training-programs/:programId`, `DELETE /training-programs/:programId`
- **Versions:** `GET /training-programs/:programId/versions`, `POST .../versions/drafts`, `GET|PATCH .../versions/:versionId`, `POST .../versions/:versionId/publish`
- **Program workouts:** `POST .../versions/:versionId/workouts`, `PATCH|DELETE .../workouts/:workoutId`
- **Program exercises:** `POST .../workouts/:workoutId/exercises`, `PATCH .../exercises/reorder`, `PATCH|DELETE .../exercises/:exerciseId`
- **Sets:** `POST .../exercises/:exerciseId/sets`, `PATCH .../sets/reorder`, `PATCH|DELETE .../sets/:setId`
- **Assignments:** `GET /training-programs/assignments`, `GET /training-programs/assignments/:assignmentId`, `POST .../assignments/:assignmentId/complete`, `POST .../assignments/:assignmentId/cancel`, `POST /training-programs/:programId/versions/:versionId/assignments`

The ellipsis above stands for the **same** `/training-programs/:programId/versions/:versionId` prefix; consult controllers or generated OpenAPI for a copyable full URL.

## Trainer capability cutover (E1 #291)

Program CRUD and draft/version/workout/exercise/set operations authorize the authenticated account via the public `UsersService.hasTrainerCapability(actor.id)` facade (which derives permissions from the current DB snapshot) on every request. Authorization is independent of the session's legacy `role` value:

- An approved `ATHLETE` with an active `TrainerProfile` can manage their **own** training programs without losing personal athlete access.
- An explicitly revoked profile denies access even when the legacy `role` is `TRAINER`; deleted users, pending applicants and administrators are denied.
- Existing `TRAINER` accounts without any profile remain supported for a compatible transition. All program and version ownership predicates still use the authenticated `actor.id` and the requested program/version ID.
- Authorization is checked before the program repository is accessed; a failed or unavailable DB lookup never grants access. No Prisma migration, public role-assignment endpoint or separate trainer account was introduced.
- **Not yet cut over:** Trainer–Athlete relationship APIs and the mixed athlete/trainer assignment list, read, completion and cancellation paths still have legacy role branches. They require separate security refactors and #361 cross-product E2E before Trainer Web #363 is enabled.

## Invariants and verification

Protect draft/published/archived rules, immutable published content, concurrent draft creation, trainer authorization, assignment ownership, workout linkage and completion/cancellation transitions. Changes across services/repositories should be tested at the HTTP and PostgreSQL levels.

**Tests:** `test/integration/training-programs/training-program-*.integration.e2e-spec.ts`, module unit tests, and linked `test/e2e/workouts/workouts.e2e-spec.ts` flows. For every contract change, regenerate OpenAPI and the frontend client.

See [workouts](workouts.md), [trainer–athletes](trainer-athletes.md), and [testing guide](../testing.md).
