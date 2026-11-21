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
