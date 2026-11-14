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

Unit tests are co-located under `apps/api/src/**/test/` (and some feature-specific locations). All HTTP E2E suites are organized under `apps/api/test/e2e/<module>/`; database/provider integration suites are grouped under `apps/api/test/integration/<module>/`. Cross-cutting security tests use `common/`, infrastructure tests use `infra/`, and shared helpers live in `apps/api/test/utility/`. The two root-level `.test.mjs` checks remain at `apps/api/test/` because CI invokes them by explicit paths.

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

Vitest discovers `test/**/*.e2e-spec.ts` recursively. **Moving files changes relative imports and migration inventory expectations**: record each legacy test relocation in `apps/api/test/relocations.json` without rewriting the frozen `apps/api/migration-source-inventory.json` (new, non-legacy tests have no historical entry). The migration-readiness gate also enforces the per-module test layout.

## Contract, architecture and migration gates

```sh
pnpm api:contract:check
pnpm --filter @gym/api architecture:check
pnpm --filter @gym/api architecture:deps
pnpm --filter @gym/api test:architecture
pnpm --filter @gym/api test:coverage-tools
```

`apps/api/test/migration-baseline.test.mjs` protects the single initial Prisma baseline and archives the original migration hashes as metadata. The root migration readiness checks preserve provenance of imported source/tests. A green repository CI does **not** imply a production cutover approval.

## Changes that require special attention

- **Auth / validation**: assert invalid-input 400 responses, normalization rules, allow/deny behavior, cookie/session refresh and OpenAPI request contracts.
- **Prisma**: regenerate the client and test migrations on a disposable database. After the first production deployment, append forward-only migrations; do not rewrite applied history.
- **Exercise ownership / trainer assignment**: cover guest, owner, trainer and cross-user denial paths.
- **Dependency updates**: run the complete CI matrix, not only unit tests.
