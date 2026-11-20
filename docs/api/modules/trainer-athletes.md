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

## Live capability for exercise sharing (E1 #291)

`getExerciseAccessContext` reads the **current persisted** `athlete` and `trainer` capabilities via `UsersService.findMyCapabilities`, instead of trusting the legacy session `role`:

- Approved trainers with a legacy `ATHLETE` role can have both athlete-side and trainer-side relationship access.
- Explicitly revoked trainer capability no longer exposes athlete exercise access through old trainer relationships, even if the session still says `TRAINER`.
- Admin/deleted accounts and failed DB lookups never grant exercise-sharing privileges. Ownership is still constrained to the authenticated user ID.
- This is an intentionally narrow access-context slice: relationship invitation, list, detail, mutation and historical-redaction branches still require capability migration in subsequent PRs. Existing API response contracts and Prisma schema are unchanged.

**Tests:** `test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts`, `test/e2e/trainer-athletes/trainer-athlete-exercise-copy.e2e-spec.ts` and module tests. Verify both parties' permissions and unauthorized transitions.

See [exercises](exercises.md), [training programs](training-programs.md), and [testing guide](../testing.md).
