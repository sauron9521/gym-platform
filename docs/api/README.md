# NestJS API handbook

The API lives in `apps/api` and uses NestJS 12 (ESM), Prisma 7/PostgreSQL, Redis and Zod. Keep source code, generated OpenAPI and behavior tests in sync. This handbook describes the **current** repository; it does not authorize production cutover.

## Feature modules

| Module | Responsibilities |
| --- | --- |
| [Authentication](modules/auth.md) | Registration, sign-in, sessions, tokens, email verification and password recovery |
| [Users](modules/users.md) | Current-user profile and avatar endpoints |
| [Exercises](modules/exercises.md) | Exercise library, private exercises and trainer access |
| [Body measurements](modules/body-measurements.md) | Measurements and statistics |
| [Workouts](modules/workouts.md) | Workout lifecycle, sets and workout creation from programs |
| [Workout analytics](modules/workout-analytics.md) | Progress summary and per-exercise analytics |
| [Trainer–athletes](modules/trainer-athletes.md) | Trainer/athlete relationships and termination |
| [Training programs](modules/training-programs.md) | Programs, versions, workouts, exercises, sets and assignments |

Infrastructure includes `src/infra/database` (Prisma), `src/infra/health`, `src/infra/openapi` and common cross-cutting HTTP/config components. These are **not** user-facing feature modules.

## Contracts

- Controllers and validation schemas in `apps/api/src` are the implementation.
- `apps/api/openapi/openapi.json` is the checked-in HTTP contract; `packages/api-client/src/generated/schema.d.ts` is the generated frontend contract.
- After changing routes or request/response schemas, run `pnpm api:contract:generate` from the monorepo root and commit both generated files. CI checks for drift.
- OpenAPI is enabled at runtime only when `ENABLE_OPENAPI=true`; do not assume it is available on a deployed instance.
- Do not silently change authentication, public/private visibility, HTTP status codes or token/cookie semantics.

## Quality and operations

- [Test and quality guide](testing.md)
- [Local API setup](../../apps/api/README.md)
- [Migration audit](../api-migration-audit.md) and [operational documentation index](../README.md)

When adding a feature module, add a `modules/<name>.md` page and link it here. Prefer links to source and generated contracts over duplicating large DTO shapes that can drift.
