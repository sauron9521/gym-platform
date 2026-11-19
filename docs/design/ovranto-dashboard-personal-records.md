# OVRANTO Athlete Dashboard — personal records KPI

## Data contract

The dashboard's **Особисті рекорди** metric is the number of **distinct strength exercises** with at least one strictly positive, server-stored external weight and repetition in a completed set of a completed workout, over the authenticated athlete's lifetime history.

- One current highest _recorded weight_ per exercise; not the number of historical improvements, achievements or estimated 1RM events.
- No invented values. A valid empty history produces a confirmed `0`. Errors and unverified data never become `0`.
- Excludes pending/skipped sets, planned/cancelled workouts, cardio, zero weight/reps, and other athletes.
- Derived from historical `workout_exercises.exercise_id` snapshots; no additional exercise-library lookup or N+1 client requests.
- Read-only `GET /workout-analytics/personal-records` returns `{ asOf, exerciseCount }`; the athlete ID is exclusively server-side.
- Client invalidates account queries on 401, does not render stale private counts during refetch, and displays retry feedback for transport/429 errors.

This is a **small authenticated dashboard slice**. Exact best lift details by exercise remain on the existing exercise progress endpoint, and achievement-history events require a separate defined product contract. No migrations, new frontend packages or trainer permissions.

Refs #384 #389 #391.
