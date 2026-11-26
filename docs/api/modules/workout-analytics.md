# Workout analytics module

## Workouts policy boundary (E14 / #652)

`WorkoutAnalyticsService` imports `assertWorkoutAthlete` from
`#src/modules/workouts/public-api`, not the internal
`workouts/policies/workout-access.policy` path. The exported function is
the **same** canonical Workouts authorization assertion. Each summary,
personal-records and exercise-history request still loads current persisted
capabilities through `UsersService.findMyCapabilities(actor.id)` before
accessing athlete-scoped SQL data. This refactor changes no permission
semantics, response schemas, Prisma queries, or throttling.

## Live athlete capability (M05 / #291)

Summary, personal records, and exercise analytics now authorize the **persisted athlete capability**, not a session's legacy `User.role`. Thus legacy TRAINER identities remain able to see their **own** workout history and analytics, while a current `ADMIN` or deleted account is denied. The analytics repository queries remain actor-id scoped. Both services use the same `UsersService.findMyCapabilities` facade; no client-supplied permission flags are trusted.

Cross-product HTTP regression: `apps/api/test/e2e/users/users.e2e-spec.ts`. Remaining cross-product/browser checks are tracked by #361.

**Source:** [`apps/api/src/modules/workout-analytics/`](../../../apps/api/src/modules/workout-analytics/)

Authenticated summary statistics and exercise-specific history/progress views.

| Method | Path                                                     |
| ------ | -------------------------------------------------------- |
| GET    | `/workout-analytics/summary`                             |
| GET    | `/workout-analytics/exercises/:exerciseId`               |
| GET    | `/workout-analytics/personal-records`                    |
| GET    | `/workout-analytics/exercises/:exerciseId/previous-sets` |

All routes have endpoint-level throttling.

The previous-sets resource is a read-only input for future workout logging
hints, not a recommendation or a personal record. It returns at most 100 actual
completed strength sets from the latest completed workout occurrence of the
requested exercise within the existing 90-day analytics window. Ties use
workout ID descending, then first exercise sort order. Skipped, pending,
planned-only and missing metrics are not suggested; valid zero weight and
partial metrics remain distinct from null. No fallback to older sessions when
the latest occurrence has no usable results. Returns only exercise ID, source
completion timestamp (null for empty history) and set number/type/actual
metrics; unknown/foreign IDs return the same empty result. No-store, live
athlete capability, strict empty query and existing analytics throttle apply.
The client must match set number AND set type, and show historical values
separately from planned and actual inputs. No automatic form filling or writes.
Mobile setting/UI integration is a subsequent slice.

Keep statistics scoped to the authenticated principal and document precise aggregation rules in the code/tests, not in ad hoc frontend calculations.

**Tests:** `test/e2e/workout-analytics/workout-analytics.e2e-spec.ts` and co-located unit tests. Include empty-history, time range and cross-user isolation checks for analytics changes.

See [testing guide](../testing.md).
