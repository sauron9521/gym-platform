# API testing and change safety

All commands are run from the monorepo root unless otherwise noted.

## Fast local checks

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api lint
pnpm --filter @gym/api typecheck
pnpm --filter @gym/api test
pnpm --filter @gym/api build
```

Unit tests are co-located under `apps/api/src/**/test/` (and some feature-specific locations). HTTP e2e tests currently reside in `apps/api/test/*.e2e-spec.ts`; database integration tests reside in `apps/api/test/integration/*.integration.e2e-spec.ts`. Shared helpers are in `apps/api/test/utility/`.

## Integration and HTTP e2e

These require a **disposable** PostgreSQL test database and Redis. Review `apps/api/.env.test.example`, `apps/api/README.md` and the CI job before running locally. `DATABASE_URL` (used by migrate/seed) and `TEST_DATABASE_URL` must refer to the same dedicated test database; never run test migrations against production.

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm --filter @gym/api typecheck:e2e
pnpm --filter @gym/api test:e2e
```

The E2E Vitest configuration currently discovers `test/**/*.e2e-spec.ts`, so future per-module subdirectories can be introduced without losing test discovery. **Moving files also changes relative imports, fixtures and migration inventory expectations**. Update those paths and `scripts/api-migration-readiness.mjs` with tests in the same PR; preserve the original legacy path provenance separately from current physical paths.

## Contract, architecture and migration gates

```sh
pnpm api:contract:check
pnpm --filter @gym/api architecture:check
pnpm --filter @gym/api architecture:deps
pnpm --filter @gym/api test:architecture
pnpm --filter @gym/api test:coverage-tools
```

`apps/api/test/migration-baseline.test.mjs` protects historical Prisma migrations. The root migration readiness checks preserve provenance of imported source/tests. A green repository CI does **not** imply a production cutover approval.

## Changes that require special attention

- **Auth / validation**: assert invalid-input 400 responses, normalization rules, allow/deny behavior, cookie/session refresh and OpenAPI request contracts.
- **Prisma**: regenerate the client; test new migrations on a disposable database and preserve historical migration files.
- **Exercise ownership / trainer assignment**: cover guest, owner, trainer and cross-user denial paths.
- **Dependency updates**: run the complete CI matrix, not only unit tests.
