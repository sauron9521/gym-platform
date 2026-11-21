# Trainer–athlete relationships module

**Source:** [`apps/api/src/modules/trainer-athletes/`](../../../apps/api/src/modules/trainer-athletes/)

Authenticated invitation/relationship management with accept, decline, cancellation and termination flows.

| Method | Path                              |
| ------ | --------------------------------- |
| POST   | `/trainer-athletes`               |
| GET    | `/trainer-athletes`               |
| GET    | `/trainer-athletes/:id`           |
| POST   | `/trainer-athletes/:id/accept`    |
| POST   | `/trainer-athletes/:id/decline`   |
| POST   | `/trainer-athletes/:id/cancel`    |
| POST   | `/trainer-athletes/:id/terminate` |

Relationship state affects trainer access to exercises and program assignment. The termination flow may require exercising copy/visibility rules for previously shared exercises; never replace it with an untested direct database update.

## Browser-friendly read throttling (E14 / #361)

Authenticated `GET /trainer-athletes` and `GET /trainer-athletes/:id` use the shared **`read` preset (60 requests per minute)**, consistent with account/profile read endpoints. Rapid Next.js navigation and client-side list refreshes must not consume the lower mutation budget; this matters because a capability-gated route also verifies the current session. All invitation and lifecycle **POST** operations retain the original stricter global limit. Identity checks, per-participant SQL filters and historical contact redaction remain unchanged.

## Transactional invitation capability guard (M05 / #291)

`POST /trainer-athletes` still performs its existing preflight capability and pair checks for clear client errors, but the final authorization decision now happens **inside the same PostgreSQL transaction as the invitation insertion**:

- Locks both participants' `users` rows in sorted ID order using `FOR UPDATE`; also locks the trainer's existing `trainer_profiles` row. PostgreSQL foreign-key locks prevent concurrent profile creation from bypassing a missing-profile legacy trainer check.
- Re-reads both user records, soft-delete state, role and TrainerProfile approval under these locks. Only an active trainer (approved profile or compatible legacy `TRAINER` without profile) and a valid non-admin athlete are eligible. A changed/deleted account or revoked trainer rejects with HTTP 409, and no relationship is inserted.
- Moderation that already holds a conflicting lock completes first, and a later invitation sees its new state. If invitation creation acquires the locks first, moderation waits until insertion commits, defining an explicit transaction ordering.
- Preserves 400 for invalid initial role pairs, 404 for a missing initial target, 409 for duplicate open pairs (including concurrent `P2002` races), and the existing response projection. No raw SQL string interpolation, database migrations or public API payload changes.
- Tests cover both invitation directions, approved `ATHLETE`-role trainers, target/admin changes, and deterministic HTTP/PostgreSQL revocation between the preflight and the database write.

## Live capability checks for relationship reads (M05 / #291)

Both `GET /trainer-athletes` and `GET /trainer-athletes/:id` now load **current persisted** user capabilities via `UsersService.findMyCapabilities`, not the role captured by an older session. Deleted and current-admin accounts cannot read relationship details even if a prior session identifies them as an athlete or trainer.

- The relationship's **own athlete** retains full contact/history access while their account remains an eligible participant.
- A trainer may read full contact details only if TrainerProfile approval (or compatible legacy trainer permission) is still active **and** that particular relationship is `ACTIVE` or `PENDING`.
- After trainer capability is revoked, the trainer can still read only a restricted projection (IDs, status and relationship metadata) for their own open/ended relationships so `decline`, `cancel` and `terminate` remain usable; emails are not returned.
- List reads query the restricted projection first, then fetch contacts only for authorized rows. The follow-up SQL query and the detail SQL query also verify current account eligibility and TrainerProfile status, so revocation between the initial capability read and the DB query cannot restore contact visibility.
- No data is exposed to unrelated users. Historical records from the user's own `athleteId` side remain fully visible, even when the user also has (or previously had) trainer capability. No schema/API contract changes or migrations.

## Live capabilities for relationship transitions (M05 / #291)

The `accept / decline / cancel / terminate` endpoints re-read the current database capabilities of the authenticated participant. Legacy session roles are not used to grant mutation privileges:

- **Accept** requires the initiator/recipient to satisfy their actual `trainerId` and `athleteId` sides: the trainer must currently have trainer capability and the athlete must still have athlete capability. A conditional Prisma update repeats these predicates at write time, so a revocation between checking and writing cannot activate the relationship. Revoked trainers or ineligible athletes cause a conflict rather than activating.
- **Decline, cancel and terminate** remain available to participants whose trainer capability was revoked, provided their account is still a valid athlete. These are exit/cleanup actions, not new grants. Existing recipient/initiator, relationship-status and ownership checks still apply.
- Admin/deleted participants are not allowed to perform relationship mutations even with stale ATHLETE/TRAINER session claims. Response redaction continues to use the participant's side in the specific relationship.
- Termination retains its atomic program-assignment/exercise-copy/access-revocation transaction. No Prisma schema changes.

Remaining follow-ups: mixed-role training-program assignments and #361 cross-product E2E before protected Trainer Web routes.

## Create invitations with live capabilities (M05 / E1 #291)

`POST /trainer-athletes` resolves the authenticated initiator and target using fresh, persisted `UsersService.findMyCapabilities` reads. It does **not** use `User.role` or the session role for trainer authorization.

- An approved trainer whose legacy role remains `ATHLETE` can invite an athlete; an ordinary athlete can invite an approved `ATHLETE`-role trainer.
- A revoked or inactive TrainerProfile does not grant trainer capability, even if the session still says `TRAINER`. Existing legacy `TRAINER` users without any profile remain compatible during migration.
- A missing/deleted target returns 404; admin initiators are forbidden; self-invitation, pairs without an active trainer, or ambiguous pairs are rejected before any relationship write.
- Both accounts with active trainer capability are **ambiguous** with the existing `{ userId }` request body (both can also be athletes). The API returns 400 rather than choosing roles silently; explicit trainer/athlete intent is a separate API contract decision.
- Duplicate open pairs keep their existing 409/concurrency handling. No new privileges, schema migration, or self-service role assignment are introduced.
- **Historical privacy is based on each relationship's side**, not the current session role: a former trainer receives a redacted list/detail and redacted decline/cancel/terminate response, even when their account role remains `ATHLETE`. An athlete keeps full access to their own history. List queries first load a restricted projection; a second SQL query allows full contact fields only for open relationships or an actor who is the relationship's athlete.

The list/detail authorization, relationship transition permission migrations and transactional invitation creation are covered above. Remaining scope includes mixed-role training-program assignments and #361 cross-product E2E. No Trainer Web protected routes are enabled by this PR.

## Live capability for exercise sharing (E1 #291)

`getExerciseAccessContext` reads the **current persisted** `athlete` and `trainer` capabilities via `UsersService.findMyCapabilities`, instead of trusting the legacy session `role`:

- Approved trainers with a legacy `ATHLETE` role can have both athlete-side and trainer-side relationship access. The exercise visibility predicate also recognizes explicitly shared athlete exercises for these accounts; it still requires an active relationship and an unrevoked trainer-access grant in the SQL query.
- Explicitly revoked trainer capability no longer exposes athlete exercise access through old trainer relationships, even if the session still says `TRAINER`.
- Admin/deleted accounts and failed DB lookups never grant exercise-sharing privileges. Ownership is still constrained to the authenticated user ID.
- The initial exercise-sharing access-context slice is complete; invitation creation and historical response redaction are covered by the subsequent create-invitations slice above. Full relationship mutation authorization still requires follow-up. Existing API response contracts and Prisma schema are unchanged.

**Tests:** `test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts`, `test/e2e/trainer-athletes/trainer-athlete-exercise-copy.e2e-spec.ts` and module tests. Verify both parties' permissions and unauthorized transitions.

See [exercises](exercises.md), [training programs](training-programs.md), and [testing guide](../testing.md).
