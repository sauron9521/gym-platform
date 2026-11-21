# OVRANTO — nearest scheduled workout on Athlete Dashboard

This API + Web slice follows merged #413. When an athlete has an
`IN_PROGRESS` workout, the active-workout hero and its authenticated
Resume link continue to take priority. Only when none are active, the
Dashboard queries the nearest **future** `PLANNED` workout.

## API contract

Optional `GET /workouts?status=PLANNED&sort=scheduledAtAsc&scheduledFrom=...&view=summary&page=1&limit=1`.

- New `sort=scheduledAtAsc` requires both `status=PLANNED` and
  `scheduledFrom` (otherwise HTTP 400); the lower date bound excludes
  unscheduled/null and past entries.
- The repository performs the sorting in PostgreSQL, with stable tie-breaker
  `id ASC`, **before LIMIT/PAGINATION**. Searching or sorting only the
  createdAt-ordered first page is not valid.
- Default `GET /workouts` remains `createdAt DESC, id DESC` for existing
  clients. Existing owner-scope/role guards, pagination and summary response
  are unchanged. The OpenAPI snapshot and typed API client include this
  new optional param.
- API unit/HTTP tests exercise the opt-in ordering, invalid parameter
  combinations and owner-scoping.

## Web behavior

- A separate TanStack Query key `workouts.nextPlanned()` calls the new
  sorted query with a fresh `scheduledFrom=new Date().toISOString()`
  on every fetch; it refreshes every minute while mounted.
- When an active workout exists, no upcoming lookup is mounted.
- Only API-confirmed future scheduled workout title, date, exercise count
  and details link are rendered. The CTA opens the **existing authorized
  details page** where the start mutation already exists; it never starts a
  workout immediately or fabricates a success state.
- No future scheduled workout: the hero falls back to **Create workout**.
  Pending, 429/error and 401 states do not expose stale cached private data.
  The centralized 401 recovery clears the query cache and redirects.
- No added packages, migrations or workout state mutations.

Next: optional direct **Start workout** on the hero via an authenticated
mutation with transition guards, pending-state lock, invalidation and feedback,
as a separate PR. Manual viewport and dark/light accessibility QA remains #389.
