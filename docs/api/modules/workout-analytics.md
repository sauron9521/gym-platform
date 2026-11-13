# Workout analytics module

**Source:** [`apps/api/src/modules/workout-analytics/`](../../../apps/api/src/modules/workout-analytics/)

Authenticated summary statistics and exercise-specific history/progress views.

| Method | Path                                       |
| ------ | ------------------------------------------ |
| GET    | `/workout-analytics/summary`               |
| GET    | `/workout-analytics/exercises/:exerciseId` |

Both routes have endpoint-level throttling. Keep statistics scoped to the authenticated principal and document precise aggregation rules in the code/tests, not in ad hoc frontend calculations.

**Tests:** `test/workout-analytics.e2e-spec.ts` and co-located unit tests. Include empty-history, time range and cross-user isolation checks for analytics changes.

See [testing guide](../testing.md).
