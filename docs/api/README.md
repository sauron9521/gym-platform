# NestJS API handbook

The API lives in `apps/api` and uses NestJS 12 (ESM), Prisma 7/PostgreSQL, Redis and Zod. Keep source code, generated OpenAPI and behavior tests in sync. This handbook describes the **current** repository; it does not authorize production cutover.

## Feature modules

| Module                                                            | Responsibilities                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Authentication](modules/auth.md)                                 | Registration, sign-in, sessions, tokens, email verification and password recovery |
| [Users](modules/users.md)                                         | Current-user profile, preferences, capabilities, avatars and Admin account reads  |
| [Exercises](modules/exercises.md)                                 | Exercise library, private exercises and trainer access                            |
| [Body measurements](modules/body-measurements.md)                 | Measurements and statistics                                                       |
| [Workouts](modules/workouts.md)                                   | Workout lifecycle, sets and workout creation from programs                        |
| [Workout analytics](modules/workout-analytics.md)                 | Progress summary and per-exercise analytics                                       |
| [Trainer–athletes](modules/trainer-athletes.md)                   | Trainer/athlete relationships and termination                                     |
| [Training programs](modules/training-programs.md)                 | Programs, versions, workouts, exercises, sets and assignments                     |
| [Trainer onboarding](modules/trainer-onboarding.md)               | Applicant submissions, operator review and TrainerProfile lifecycle               |
| [Account deletion requests](modules/account-deletion-requests.md) | Authenticated, confirmed deletion request intake and receipt; not actual deletion |

Infrastructure includes `src/infra/database` (Prisma), `src/infra/health`, `src/infra/openapi` and common cross-cutting HTTP/config components. These are **not** user-facing feature modules.

## Contracts

- Controllers and validation schemas in `apps/api/src` are the implementation.
- `apps/api/openapi/openapi.json` is the checked-in HTTP contract; `packages/api-client/src/generated/schema.d.ts` is the generated frontend contract.
- After changing routes or request/response schemas, run `pnpm api:contract:generate` from the monorepo root and commit both generated files. CI checks for drift.
- OpenAPI is enabled at runtime only when `ENABLE_OPENAPI=true`; do not assume it is available on a deployed instance.
- Do not silently change authentication, public/private visibility, HTTP status codes or token/cookie semantics.

## Nest feature dependency boundaries (E14 / #654)

The API feature modules form an acyclic `@Module.imports` graph; the
`apps/api/scripts/check-feature-dependencies.mjs` AST guard also rejects
cross-feature access to private repositories, policies, controllers and selects.
Pure functions/types exposed through a feature's explicit `public-api.ts`
entrypoint do not need a Nest provider.

For **named runtime imports from another feature's `services/`**, the
owning feature must both be present in the consumer's `@Module.imports`
and list the imported service/facade under its own literal
`@Module({ exports: [...] })`. This prevents compiling a class import
that Nest cannot inject at runtime. Type-only imports do not require a
provider or a Nest module edge. For runtime providers, avoid importing
`services/` just for a pure helper: expose helpers from `public-api.ts`.

### Local Nest dependency registrations (E14 / #657)

The same AST guard now checks class-typed constructor dependencies of
locally registered `providers` and `controllers`. If an injected class
is declared within that feature module, the owner must register it under
`@Module({ providers: [...] })`. A locally defined class listed under
`exports` must likewise be a registered provider. These checks catch
missing internal DI registrations without instantiating application services.

The static analysis intentionally skips nonlocal dependencies such as
`PrismaService`, explicit `@Inject(token)` and optional constructor
parameters, as well as non-literal dynamic/factory registration patterns.
It cannot replace actual Nest bootstrap and HTTP/E2E verification, and
does not automatically validate tokens registered by dynamic modules.

### Intra-feature provider injection cycles (E14 / #661)

Registered, locally declared class providers must also form an **acyclic
constructor injection graph**. The architecture guard reports a deterministic
path for a cycle (including direct self-injection), for example
`FirstService -> SecondService -> FirstService`. This complements the
existing checks for Nest module cycles, missing local providers and missing
cross-feature exports.

This source-level guard includes only class-typed constructor injections
between classes listed in the same feature's literal `providers` array.
It intentionally skips explicit `@Inject(token)` and optional dependencies,
dynamic factories and externally registered providers. Such paths require
runtime Nest bootstrap/integration verification; the guard does not claim to
prove the absence of all possible dependency cycles.

The dependency check intentionally handles **direct named static imports**
and explicit, literal Nest metadata export arrays. It is not a replacement
for API bootstrap/integration tests or an exhaustive DI graph verifier;
advanced dynamic provider/export patterns require separate review.
Run `pnpm --filter @gym/api architecture:deps` and
`pnpm --filter @gym/api test:architecture` before review.

## Quality and operations

- [Current endpoint permission and ownership matrix](permission-matrix.md) — #288 audit baseline; not a release/security GO
- [Test and quality guide](testing.md)
- [Read-only API performance baseline](performance-baseline.md)
- [Local API setup](../../apps/api/README.md)
- [Migration audit](../audits/api-migration-audit.md) and [operational documentation index](../README.md)

When adding a feature module, add a `modules/<name>.md` page and link it here. Prefer links to source and generated contracts over duplicating large DTO shapes that can drift.
