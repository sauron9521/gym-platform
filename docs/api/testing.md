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

Unit tests are co-located under `apps/api/src/**/test/` (and some feature-specific locations). HTTP e2e tests are gradually being organized into `apps/api/test/e2e/<module>/` (Auth and body measurements have dedicated folders); legacy HTTP suites remain at `apps/api/test/*.e2e-spec.ts`. Database integration tests reside under `apps/api/test/integration/`; the first Auth suites are grouped in `apps/api/test/integration/auth/` while the other suites are being migrated incrementally. Shared helpers are in `apps/api/test/utility/`.

## Integration and HTTP e2e

These require a **disposable** PostgreSQL test database and Redis. Review `apps/api/.env.test.example`, `apps/api/README.md` and the CI job before running locally. `DATABASE_URL` (used by migrate/seed) and `TEST_DATABASE_URL` must refer to the same dedicated test database; never run test migrations against production.

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm --filter @gym/api typecheck:e2e
pnpm --filter @gym/api test:e2e
```

All HTTP test hosts that manually call `createNestApplication()` must register `StandardSchemaValidationPipe` to mirror production. Do not add the legacy `ValidationPipe`: request-body and query validation use module-owned Zod/Standard Schema contracts. Tests asserting invalid requests must validate the real HTTP `400` response, not only call Zod directly.

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
