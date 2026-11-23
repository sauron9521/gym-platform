# Exercises module

**Source:** [`apps/api/src/modules/exercises/`](../../../apps/api/src/modules/exercises/)

Maintains the exercise library, user-owned exercises and trainer access. Lists/details may be available to guests subject to visibility rules; writes and trainer-access management require authorization.

| Method | Path                                       | Purpose                              |
| ------ | ------------------------------------------ | ------------------------------------ |
| GET    | `/exercises`                               | List visible exercises               |
| GET    | `/exercises/:id`                           | Read visible exercise                |
| POST   | `/exercises`                               | Create exercise                      |
| PATCH  | `/exercises/:id`                           | Update exercise                      |
| DELETE | `/exercises/:id`                           | Archive/delete under ownership rules |
| GET    | `/exercises/:id/trainer-access`            | List trainer access                  |
| POST   | `/exercises/:id/trainer-access`            | Grant trainer access                 |
| DELETE | `/exercises/:id/trainer-access/:trainerId` | Revoke trainer access                |

Treat public/global, private/owned and trainer-visible exercises differently; a guest must never gain private exercise access. Preserve archive visibility and trainer-relationship termination rules. Review `src/modules/exercises/` source for the authoritative ownership implementation.

**POST creation scope (legacy-compatible):** The optional `creationScope`
request field accepts only `ATHLETE` or `TRAINER`; the persisted `source`
remains server-controlled and cannot be supplied by the client.

- `creationScope: "ATHLETE"`: creates `ATHLETE_CUSTOM`, default `PRIVATE`;
  requires current Athlete capability, including for legacy `TRAINER` users.
- `creationScope: "TRAINER"`: creates `TRAINER_CUSTOM`; requires current
  Trainer capability and does not support `visibility`. A revoked Trainer
  gets `403` rather than silently creating another exercise source.
- No `creationScope` (existing clients): `ATHLETE` defaults to personal,
  active legacy `TRAINER` defaults to Trainer, and `ADMIN` creates
  `GLOBAL`. An approved `ATHLETE` with TrainerProfile stays personal by
  default; a revoked legacy Trainer falls back to personal.
- Admin cannot request Athlete/Trainer scope via this public endpoint. Unknown
  values (including `GLOBAL`) are rejected by the strict request schema.

The API checks **current persisted capabilities**, never a frontend context or
stale JWT role, before creating a record. Training Program Builder also checks
current Trainer capability before resolving a program's library exercise;
approved `ATHLETE`-role trainers may select global and **self-owned**
`TRAINER_CUSTOM` exercises only. Foreign Trainer exercises, personal
`ATHLETE_CUSTOM` exercises and archived items remain unavailable to program
drafts. Revocation blocks selection even for a former `TRAINER`-role user;
program ownership and editable-draft checks remain separate requirements.
When **adding a library exercise to a program draft**, the final repository
write rechecks Trainer capability **within the write transaction**. It locks
the current User row (`FOR UPDATE`) and optional TrainerProfile row
(`FOR SHARE`) until the nested draft INSERT commits. Moderation revocation
must therefore serialize before or after the write, even if the earlier
service check observed a stale grant. The exercise still requires the owned
draft/version/workout boundary; no private or foreign library access is added.

Direct `POST /exercises` also uses the shared transactional User/Profile
lock capability snapshot before its final `INSERT`: a Trainer revocation,
Admin demotion or promotion to Admin after preflight cannot authorize a stale
`TRAINER_CUSTOM`, `GLOBAL` or `ATHLETE_CUSTOM` write. Source selection is
recomputed using the existing exercise policy, and a changed implicit
default is rejected instead of silently changing the exercise type.

Other write paths (program set/workout edits, publication, and exercise
updates/archives) still need individual concurrency review under #288.

**Tests:** `test/e2e/exercises/exercises.e2e-spec.ts`, `test/integration/exercises/exercise-trainer-access.integration.e2e-spec.ts`, `test/integration/exercises/exercise-program-library.integration.e2e-spec.ts`,
`test/integration/exercises/exercise-create-revocation.integration.e2e-spec.ts`
and co-located module unit tests.

See [testing guide](../testing.md).
