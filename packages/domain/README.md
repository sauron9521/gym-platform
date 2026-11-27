# @gym/domain

Pure, deterministic and platform-neutral workout rules. No NestJS, React, Prisma,
Expo or network dependencies. Read-only helpers can be used by Web, Mobile and API
without exposing or importing a database model.

- `canTransitionWorkout` provides UX-level allowed state transitions.
- `workoutCompletionFailure` identifies unprocessed sets before missing completed sets.
- `canCompleteWorkout` delegates to that same rule. The API checks it again on
  authoritative set statuses under the workout row lock. Clients must still handle HTTP 409.
- `workoutSetProgress` reports completed, skipped and pending set counts.

- `restDurationPresets`, `isRestDuration` and `defaultWorkoutPreferences` define
  shared account workout preference values. They do not persist or synchronize them.

This package does **not** authorize transitions, mutate workout state or provide
persistent data. The NestJS service/repository remains authoritative and keeps
row-locking, permissions and concurrency control.

Run with Node.js 24: `pnpm --filter @gym/domain test`.

The public export is native ESM JavaScript with TypeScript declarations. It runs directly in Node 24, including a pnpm-deployed API image, without stripping TypeScript from dependencies or introducing a package build step. The package delegates technical datetime operations to @gym/datetime; it has no framework dependencies. API and Mobile consume the same export; the server still checks authorization and authoritative database state.

## Calendar display policy (#341)

`workoutCalendarStatus` derives MISSED for a still-PLANNED workout
after the scheduled civil day ends and COMPLETED_LATE for completion
on a later civil day. Neither is a stored WorkoutStatus or a transition.
The function accepts an explicit current instant and optional calendar
zone; invalid/missing timestamps preserve the canonical status.
