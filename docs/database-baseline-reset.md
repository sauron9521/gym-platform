# PostgreSQL migration history and frozen baseline

## Current migration policy

The initial Prisma migration at `apps/api/prisma/migrations/20261114000000_initial_baseline/migration.sql` is frozen. It is the first migration in the active, forward-only history; subsequent timestamped migrations extend the schema. The migration directories, not a hard-coded count in this guide, are the source of truth.

Do not regenerate or edit the initial baseline, rewrite an applied migration, or alter its recorded hash to make a check pass. Use a new reviewed migration for schema changes. A new database must receive the complete active migration chain in order.

## Historical reset — 14 November 2026

Before the first Gym Platform production database, the baseline was generated from the Prisma schema of that date using `prisma migrate diff --from-empty --to-schema prisma/schemas --config prisma7.config.ts --script`. This is historical provenance, **not an instruction to regenerate the baseline against today's schema**.

The initial generated SQL retains three partial unique indexes and one manually appended PostgreSQL `CHECK` constraint, `body_measurements_at_least_one_metric`. The 24 former migration hashes are retained as audit metadata in `apps/api/migration-baseline.json`; the legacy SQL chain is not part of the active migrations.

## Verify the history without changing a database

From the repository root:

```sh
pnpm --filter @gym/api db:baseline:check
pnpm --filter @gym/api test:contracts
```

The baseline verifier checks the frozen Git blob hash, manual constraint marker and subsequent migration directory names/non-empty SQL. With incremental migrations present, it deliberately does not compare the frozen baseline alone against today's schema. The API PostgreSQL CI suite applies the complete active chain to an empty disposable database and uses Prisma migrate diff to verify the migrated schema. The baseline hash check alone is not evidence of schema parity.

## Local or disposable test database setup

Verify the actual `DATABASE_URL` before running any migration or seed. For tests, `DATABASE_URL` and `TEST_DATABASE_URL` must both identify the same disposable local `*_test` database. Prisma migrate/seed do not automatically load `.env.test`. See the [API setup](../apps/api/README.md) and [local Docker guide](../infra/docker/README.md).

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:validate
pnpm --filter @gym/api db:baseline:check
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:migrate:status
pnpm --filter @gym/api db:seed
```

A database already initialized with the frozen baseline can receive pending forward migrations. A database that recorded the old standalone migration chain or the previous pre-reset squash cannot be upgraded merely by applying this baseline. Stop and inspect its migration history. Recreate only an explicitly identified disposable database after approval; preserve any non-disposable data and use a separately reviewed migration/recovery plan. Do not reset production or shared staging databases.

## Release compatibility

Two-release staging upgrade/rollback evidence must use compatible post-reset releases and preserve data through forward migrations. Runtime-only rollback must be rehearsed against the newer schema; never blindly reverse SQL migrations. Production cutover remains NO-GO until the independent [release evidence review](production-readiness-review.md) and operator approvals are satisfied.
