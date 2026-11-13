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

**Tests:** `test/trainer-athletes.e2e-spec.ts`, `test/trainer-athlete-exercise-copy.e2e-spec.ts` and module tests. Verify both parties' permissions and unauthorized transitions.

See [exercises](exercises.md), [training programs](training-programs.md), and [testing guide](../testing.md).
