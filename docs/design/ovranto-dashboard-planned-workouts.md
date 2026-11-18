# OVRANTO Dashboard — API-backed planned workouts

This single small slice extends the approved dashboard foundation (#409).
The widget is rendered **only for authenticated ATHLETE accounts**. The API's
`assertWorkoutAthlete` rejects trainer/admin workout reads, so the client does
not call `GET /workouts` for those roles.

## Grounded API contract

- Reuses `workoutListQueryOptions('PLANNED', 1)`, the existing owner-scoped,
  compact `GET /workouts?view=summary&status=PLANNED&page=1&limit=10`
  query. No new endpoint, schema, dependencies or duplicate cache keys.
- Backend sorts pages by `createdAt DESC, id DESC`, **not by scheduledAt**.
  The UI deliberately says **"Останні додані плани"** rather than claiming
  to show the next scheduled event. It displays at most three of those
  records and a real total from `data.meta.total`.
- Each row shows the API title, optional scheduled date and exercise count,
  and links to its existing authenticated `/workouts/[id]` details page.
  Nothing starts a workout automatically; workout start remains an explicit
  authenticated mutation on the details screen.
- There are distinct loading/refetching, error, empty, and populated states.
  HTTP 401 renders no cached private content and uses the central
  `useAuthFailure` handler to clear the query cache and redirect. 403 and
  429 remain safe errors with an explicit retry.
- The source of truth for authentication is still each protected server page.
  DashboardSession sign-out and user validation are untouched. React Query
  retains its existing browser-only cache and invalidation conventions.

## Out of scope

True nearest-workout ordering requires a dedicated scheduledAt ASC API
contract; do not fake that from a createdAt-sorted partial page. Progress
charts, workout totals for other statuses, and personalized next-session
hero will each be reviewed separately. Existing hero and approved
OVRANTO typography/palette remain unchanged.

Manual 320/375/768/1280+ responsive, UK/EN and Light/Dark viewport checks
are still tracked by #389. This PR adds deterministic component tests for
real/pending/empty/error/401 states and remains independent of unrelated PRs.
