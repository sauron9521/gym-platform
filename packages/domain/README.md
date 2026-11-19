# @gym/domain

Pure, deterministic and platform-neutral workout rules. No NestJS, React, Prisma,
Expo or network dependencies. Read-only helpers can be used by Web, Mobile and API
without exposing or importing a database model.

- `canTransitionWorkout` provides UX-level allowed state transitions.
- `canCompleteWorkout` mirrors the minimum set-completion invariant currently
  enforced transactionally on the API. Clients must still handle HTTP 409.
- `workoutSetProgress` reports completed, skipped and pending set counts.

This package does **not** authorize transitions, mutate workout state or provide
persistent data. The NestJS service/repository remains authoritative and keeps
row-locking, permissions and concurrency control.

Run with Node.js 24: `pnpm --filter @gym/domain test`.
