# Workouts module

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
