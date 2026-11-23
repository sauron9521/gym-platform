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

**POST creation scope (legacy-compatible):** Source is server-selected, never
accepted from client input. The API re-reads current account capabilities from
the database before creating an exercise: Admin creates `GLOBAL` only with
Admin capability; a legacy `TRAINER` with live Trainer capability defaults to
`TRAINER_CUSTOM`; `ATHLETE` (including an approved TrainerProfile) defaults to
`ATHLETE_CUSTOM`. A revoked legacy Trainer retains personal Athlete creation
but cannot create another Trainer exercise. An explicit dual-capability
creation-purpose selector is not yet part of the HTTP contract. Do not infer
Trainer access from a stale JWT role or frontend app context. Future strict
insert-time revalidation belongs to #288.

**Tests:** `test/e2e/exercises/exercises.e2e-spec.ts`, `test/integration/exercises/exercise-trainer-access.integration.e2e-spec.ts` and co-located module unit tests.

See [testing guide](../testing.md).
