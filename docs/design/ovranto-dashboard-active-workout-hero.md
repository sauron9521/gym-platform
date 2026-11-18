# OVRANTO Athlete Dashboard — active workout hero

This single small slice builds on merged #412 without introducing any new API
endpoint, dependency, database change or workout mutation.

## Data source and semantics

- `DashboardActiveWorkout` is mounted only for the `ATHLETE` role.
  Other roles retain the existing static DashboardHome hero and do not call
  the athlete-only workouts endpoint.
- Reuses `workoutListQueryOptions('IN_PROGRESS', 1)` with the exact TanStack
  Query cache key already used by the #411 status KPI widget. No duplicate
  network request for the same filter/page when both components mount.
- The API returns the athlete's own `IN_PROGRESS` workouts ordered by
  **createdAt DESC, id DESC**. The primary CTA opens the *most recently
  created* in-progress workout's existing `/workouts/[id]` details page.
  The copy does **not** call this the most recently started session.
- "Продовжити тренування" is **navigation, not a POST /start**. The details
  route already supports editing workout sets and lifecycle controls; the
  button never submits a duplicate start or marks a set complete.
- With zero active workouts, the hero shows the existing create-workout
  and journal routes. Error states (including 429) show a safe message and
  retry rather than an unverified resume link or create action.
- While pending/refetching, cached private workout details are hidden. On
  HTTP 401 the private hero is hidden and `useAuthFailure` clears the private
  TanStack Query cache and redirects to sign-in.

Existing session validation and sign-out are unchanged. `DashboardHome` is
still pure presentation with an optional hero override; without one the
approved welcome/create-workout hero remains unchanged.

## Follow-ups

A true next `PLANNED` workout by scheduled date requires an explicit
`scheduledAt ASC` API contract. It should not be inferred from a
createdAt-ordered partial page. A date-ordered next session and any direct
start mutation can be reviewed separately. Visual acceptance at narrow
breakpoints and Light/Dark contrast remains tracked by #389.
