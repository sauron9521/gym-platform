# Workouts module

## Live athlete capability (M05 / #291)

Personal workout read, creation and lifecycle operations authorize the **current database-derived** athlete capability via `UsersService.findMyCapabilities`, not the actor's cached `role`. Existing `TRAINER`-role accounts and approved `ATHLETE`-role trainers retain their own athlete workouts; revoked trainer approval removes trainer privileges **without** removing personal athlete history. An account currently promoted to `ADMIN`, or deleted, cannot use athlete workout routes even with a stale non-admin session. Existing `athleteId`-scoped queries still prevent cross-account IDOR. No API shape or Prisma migrations changed.

Cross-product HTTP regression: `apps/api/test/e2e/users/users.e2e-spec.ts`. More complete security browser/mobile coverage follows in #361.

**Source:** [`apps/api/src/modules/workouts/`](../../../apps/api/src/modules/workouts/)

Authenticated workout creation, retrieval, editing, set updates, lifecycle transitions and creation from a training program.

| Method | Path                        | Purpose               |
| ------ | --------------------------- | --------------------- |
| POST   | `/workouts`                 | Create                |
| GET    | `/workouts`                 | List                  |
| GET    | `/workouts/:id`             | Detail                |
| PATCH  | `/workouts/:id`             | Update                |
| POST   | `/workouts/:id/start`       | Start                 |
| PATCH  | `/workouts/:id/sets/:setId` | Update set            |
| POST   | `/workouts/:id/complete`    | Complete              |
| POST   | `/workouts/:id/cancel`      | Cancel                |
| POST   | `/workouts/from-program`    | Create from a program |

Preserve transitions and invariants (especially completion and assignment state), ownership checks and version linkage. Controllers and generated OpenAPI are the source of truth for accepted fields and transition error codes.

**Tests:** `test/e2e/workouts/workouts.e2e-spec.ts`, `test/integration/workouts/workouts.repository.integration.e2e-spec.ts` and co-located module tests.

See [training programs](training-programs.md) and [testing guide](../testing.md).

## Transactional management authorization (Issue #288)

Planned-workout `PATCH /workouts/:id` and `POST /workouts/:id/cancel`
now perform a final **current database-derived Athlete capability** check in
one PostgreSQL transaction with the actual conditional UPDATE. The existing
`UsersService.findMyCapabilitiesForWrite` holds the User/Profile row locks
through commit, so account suspension or promotion to Admin between the
preflight and the final write must deny rather than mutate a workout using a
stale actor/session. Existing `athleteId` and lifecycle status predicates,
and conflict mapping, remain unchanged.

Legacy/approved/revoked Trainers retain access to their own personal
workouts while their current Athlete capability remains active. A PostgreSQL
regression holds an uncommitted account promotion while planned edit and
cancellation wait for the account lock; neither may mutate the workout after
promotion. Creation, set-result updates and start/complete operations are
**separate** authorization review slices; do not infer they share this
transactional boundary. No Prisma migration or API contract changes.

## Transactional result-set authorization (Issue #288)

`PATCH /workouts/:id/sets/:setId` retains its service-side payload,
state, and ownership validation. Before the final set UPDATE, a PostgreSQL
transaction rechecks the **current persisted Athlete capability** under
User/Profile locks. It then locks the parent workout with `FOR UPDATE`,
scoped to both the exact route `workoutId` and persisted `athleteId`.
A set ID alone never authorizes a write. This serializes with moderation
(role promotion/suspension) and workout completion without altering
the existing `409` conflict on a no-longer-active workout.

Approved and former Trainers retain personal set access while their
Athlete capability is active. PostgreSQL race tests cover an uncommitted
account promotion and suspension, plus foreign workout/athlete contexts.
No Prisma migration or HTTP contract changes. Workout creation and
remaining lifecycle writes are separate #288 authorization review slices.

## Atomic manual workout creation authorization (Issue #288)

`POST /workouts` still performs normal Athlete preflight, input validation,
exercise visibility checks, and existing transaction-scoped exercise and
TrainerAthlete locks. Before the final manual workout INSERT, the same
transaction now re-evaluates the **current persisted Athlete capability**
under User/Profile row locks via `UsersService.findMyCapabilitiesForWrite`.
Account promotion or suspension and workout creation therefore serialize
rather than authorizing a stale Athlete session. No bypass is available via
the repository's manual-create method: a transaction authorization callback
is required.

The authorization happens **after** exercise and relationship access locks
and **before** the insert; the locks are held through commit. Current
Athlete-capable former Trainers retain their own manual workouts. PostgreSQL
race tests cover an uncommitted Athlete-to-Admin promotion and suspension,
asserting that neither creates a workout after moderation commits. There
are no HTTP/Prisma schema or migration changes. Program-based creation,
workout start/completion, and remaining #288 endpoints require separate
review; a successful CI run does not imply production security sign-off.
