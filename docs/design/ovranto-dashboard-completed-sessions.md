# OVRANTO Athlete Dashboard — completed workout records

This small, isolated UI slice follows merged PR #411. It adds an ATHLETE-only
section listing up to three completed workout records and links to existing
authenticated `/workouts/[id]` pages.

## Verified API data and sorting

- Reuses the existing `workoutListQueryOptions('COMPLETED', 1)`, sharing
  TanStack Query cache with the #411 completed status KPI.
- Calls the existing owner-scoped compact `GET /workouts` endpoint with
  `status=COMPLETED`, `view=summary`, `page=1`, `limit=10`.
- Backend sorts by `createdAt DESC, id DESC` (not `completedAt`).
  Copy says **"Останні додані записи серед завершених тренувань"** and
  does not claim the rows are the most recently finished workouts.
- Each row uses API-provided `title`, `completedAt` (if present), and
  `exerciseCount`. Missing completion dates are labeled honestly, never
  replaced with today's date or an invented duration.
- The widget handles pending/refetching, empty, error/retry and ready states.
  HTTP 401 renders nothing and delegates session invalidation to the
  existing auth-failure hook. No private workout data from a stale cache
  survives a failed session check.

No routes, database migrations, new packages, workout mutations,
authorization policies or workout-list i18n catalogs are changed.

## Separate follow-ups

Actual completion-time ordering needs an explicit backend query contract,
which should be separately reviewed. Subsequent dashboard slices can add
an API-backed next scheduled workout, a genuine Start/Resume path, accessible
7/30/90-day progression charts and translation catalogs.
Manual responsive/light/dark/a11y visual acceptance remains in #389.
