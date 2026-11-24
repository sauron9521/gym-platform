# Gym Platform API

NestJS 12 / Prisma 7 API, migrated from the existing standalone repository.

## Migration status

- Prisma multi-file schemas are preserved. The active history starts with the frozen `20261114000000_initial_baseline` and includes subsequent forward-only migrations. Legacy SQL migration hashes are audit metadata, not executable migrations.
- NestJS `src/`, unit tests, and e2e/integration test files have been imported.
- API configuration, Prisma seed, ESM package aliases, and pnpm dependencies are restored.
- The root monorepo CI generates Prisma, then runs format, lint, typecheck, unit tests and build.
- Database-backed integration/e2e tests run on disposable PostgreSQL 17 and Redis 7 in CI. Local Docker Compose uses Redis 8 (see the infrastructure guide).
- Production deployment is **not enabled yet**.

## Local development

From the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api build
pnpm --filter @gym/api test
```

For a local PostgreSQL/Redis stack, follow [infra/docker/README.md](../../infra/docker/README.md).
Copy `apps/api/.env.local.example` to the ignored `apps/api/.env` and keep its
PostgreSQL password aligned with `infra/docker/.env`. Development API uses port
`3001`; Next.js uses `3000`. Start the API with `pnpm dev:api`.

## Integration / e2e tests

The `API e2e / PostgreSQL 17` required GitHub Actions gate verifies two
PostgreSQL 17 test shards and API coverage. Test jobs use a disposable
`gym_app_test` database, generate Prisma Client, apply the complete active
migration chain, seed exercise data, typecheck e2e sources and execute the suite.

To run the suite locally, start PostgreSQL and Redis and configure both
`TEST_DATABASE_URL` and `DATABASE_URL` to point to the **same disposable
local `*_test` database**. Set test-only JWT and application environment
variables using `apps/api/.env.test.example` as a reference.

**Important:** Prisma migrate/seed use `DATABASE_URL` and do not automatically
read `.env.test`. Verify the URL before applying migrations. Never run
`db:migrate:deploy` or `db:seed` against production during migration.

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm --filter @gym/api typecheck:e2e
pnpm --filter @gym/api test:e2e
```

## Safety

Do not deploy this API or apply schema migrations against production until staging
has validated API parity, database configuration, and rollback procedures.
The standalone `gym-api-nestjs` repository remains the operational source of truth.

## Migration provenance

The API source and tests were imported from commit
`79e53bc1b7a78bb3856ff2aeab2529559240521e` of
`sauron9521/gym-api-nestjs`. The Prisma migration history baseline is tested
separately by `test/migration-baseline.test.mjs`.

## Migration parity and cutover

All 302 source and 48 test paths from the recorded legacy commit were imported;
the original schema and historical migration hashes are archived in
migration provenance metadata. The frozen initial baseline and subsequent forward-only migrations are active;
legacy SQL migration files must **not** be applied to a new database.
Modified source/test blobs still require staging review.
The read-only [cutover audit](../../docs/audits/api-migration-audit.md) explicitly
lists remaining staging/rollback/approval blockers. **Production NO-GO:**
merging the repository audit does not transfer operational ownership.

For the fresh-schema migration rules, see the [baseline reset and verification guide](../../docs/database-baseline-reset.md).

## Signed GHCR staging rehearsal

The manual-only `staging-ghcr.yml` workflow verifies published runtime and
Prisma migration image digests, exercises health/auth/profile HTTP flows
against disposable PostgreSQL 17 and Redis 7, and tests migration replay
and same-digest restart. It does **not** deploy or approve production.
See [staging operator guide](../../docs/operations/staging-ghcr-monorepo.md).

## Module documentation

Start with the [NestJS API handbook](../../docs/api/README.md) for feature modules, HTTP route maps and contract ownership. The [API testing guide](../../docs/api/testing.md) describes unit, e2e and PostgreSQL integration checks. The [documentation index](../../docs/README.md) keeps the migration and operational runbooks discoverable.
