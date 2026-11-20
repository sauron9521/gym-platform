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

## Create invitations with live capabilities (M05 / E1 #291)

`POST /trainer-athletes` resolves the authenticated initiator and target using fresh, persisted `UsersService.findMyCapabilities` reads. It does **not** use `User.role` or the session role for trainer authorization.

- An approved trainer whose legacy role remains `ATHLETE` can invite an athlete; an ordinary athlete can invite an approved `ATHLETE`-role trainer.
- A revoked or inactive TrainerProfile does not grant trainer capability, even if the session still says `TRAINER`. Existing legacy `TRAINER` users without any profile remain compatible during migration.
- A missing/deleted target returns 404; admin initiators are forbidden; self-invitation, pairs without an active trainer, or ambiguous pairs are rejected before any relationship write.
- Both accounts with active trainer capability are **ambiguous** with the existing `{ userId }` request body (both can also be athletes). The API returns 400 rather than choosing roles silently; explicit trainer/athlete intent is a separate API contract decision.
- Duplicate open pairs keep their existing 409/concurrency handling. No new privileges, schema migration, or self-service role assignment are introduced.

Remaining capability migration: list/detail/accept/decline/cancel/terminate, sensitive historical projections, mixed-role training-program assignments and #361 cross-product E2E. A future concurrency hardening slice should guard against revocation racing an in-flight invitation. No Trainer Web protected routes are enabled by this PR.

## Live capability for exercise sharing (E1 #291)

`getExerciseAccessContext` reads the **current persisted** `athlete` and `trainer` capabilities via `UsersService.findMyCapabilities`, instead of trusting the legacy session `role`:

- Approved trainers with a legacy `ATHLETE` role can have both athlete-side and trainer-side relationship access. The exercise visibility predicate also recognizes explicitly shared athlete exercises for these accounts; it still requires an active relationship and an unrevoked trainer-access grant in the SQL query.
- Explicitly revoked trainer capability no longer exposes athlete exercise access through old trainer relationships, even if the session still says `TRAINER`.
- Admin/deleted accounts and failed DB lookups never grant exercise-sharing privileges. Ownership is still constrained to the authenticated user ID.
- This is an intentionally narrow access-context slice: relationship invitation, list, detail, mutation and historical-redaction branches still require capability migration in subsequent PRs. Existing API response contracts and Prisma schema are unchanged.

**Tests:** `test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts`, `test/e2e/trainer-athletes/trainer-athlete-exercise-copy.e2e-spec.ts` and module tests. Verify both parties' permissions and unauthorized transitions.

See [exercises](exercises.md), [training programs](training-programs.md), and [testing guide](../testing.md).
