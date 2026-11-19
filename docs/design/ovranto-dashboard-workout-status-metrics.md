# OVRANTO Athlete Dashboard — status metrics

This single PR adds three **API-backed** KPI cards to the approved Athlete
Dashboard, after merged #410. The read-only widget is mounted only for an
authenticated `ATHLETE` role. Trainers and admins are not entitled to
`GET /workouts` and therefore do not mount it.

## Grounded metrics

- **Заплановані:** `GET /workouts?status=PLANNED&view=summary&page=1&limit=10`
- **У процесі:** `GET /workouts?status=IN_PROGRESS&view=summary&page=1&limit=10`
- **Завершені:** `GET /workouts?status=COMPLETED&view=summary&page=1&limit=10`

Each number comes directly from the server-provided `meta.total`; it is
**all-time count**, not a last-week count or a count from the first page.
Cancelled workouts are intentionally excluded and the copy states this.
No benchmark, completion rate, streak, estimated strength, or synthetic
statistics are presented.

The widget reuses `workoutListQueryOptions` and its existing owner-scoped
TanStack Query keys. `PLANNED` shares the exact query key with the #410
planned workout list, allowing Query to deduplicate the read. No new
endpoint, database migration, package, cache policy or permission was added.

Each status independently handles loading/refetching, a safe retryable error,
and successful zero. Cached numbers are hidden while refetching. If any
status returns HTTP 401, the whole metric widget renders nothing and
`useAuthFailure` invalidates the private query cache and redirects to
the sign-in page. Other status errors do not expose raw server content.

## Follow-ups (separate PRs)

- Actual recent completed workout sessions with details links.
- Real scheduledAt-ascending next workout API contract and supported Start
  or Resume CTA (not inferred from createdAt-sorted partial pages).
- Accessible 7/30/90-day progression chart derived from supported series.
- EN/UK message extraction, real viewport, dark/light and a11y QA in #389.
