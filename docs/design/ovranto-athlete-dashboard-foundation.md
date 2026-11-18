# OVRANTO Athlete Dashboard — truthful hero and navigation slice

Follow-up to #407, independent of the unmerged sidebar collapse PR #408.

This slice replaces the existing narrow Gym Platform welcome card with an
OVRANTO visual foundation: wide welcome heading, restrained next-step hero,
Deep Teal primary CTA, outlined secondary action, and responsive quick-access
cards. It uses existing `@gym/ui-web` controls and semantic palette tokens.

## Data and API truthfulness

- The hero **does not claim that a workout is scheduled or available**.
  `/workouts/new` opens the already-existing create-workout form, so the
  CTA says "Створити тренування", **not** "Почати тренування".
- `/workouts` opens the existing authenticated journal.
- Role-specific shortcuts use only existing routes; unauthorized roles never
  receive a shortcut to Athlete or Trainer programs from this dashboard.
  Server-side route guards remain the security authority.
- No mocked analytics, record count, personal records, workout sessions,
  fake progress bars, charts, prices or invented APIs.
- The existing `DashboardScreen` session refresh, 401 redirect,
  forbidden/unavailable states, sign-out call and TanStack cache clearing
  remain unchanged. Only the ready-state presentation is extracted.
- Keep current Ukrainian dashboard strings; localization of this screen
  should be a separate coherent i18n change. No shared dictionaries edited.

## Next implementation slices

1. API-backed next workout / current-session hero with truthful empty
   fallback and primary **Start Workout** only if the supported action
   genuinely starts or resumes that session.
2. Read API-backed KPI counts and recent workouts (no invented totals).
3. 7/30/90-day accessible progression chart and genuine drill-down.
4. Visual & a11y QA at 320/375/768/1280+ widths, light/dark/system,
   keyboard, 200% zoom and approved design board.

This PR is not full Dashboard sign-off. Cross-app visual acceptance remains
with #389; the broad Athlete experience issue #384 remains open.
