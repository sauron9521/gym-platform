# Fresh PostgreSQL baseline — 14 November 2026

The active Prisma migration history was reset **before the first Gym Platform production database**. Exactly one initial migration is tracked at `apps/api/prisma/migrations/20261114000000_initial_baseline/migration.sql`.

## What this changes

- The 24 imported SQL migrations were consolidated in chronological order. Historical migration hashes from the legacy standalone repository are preserved as *metadata only* in `apps/api/migration-baseline.json`.
- The final three `CREATE/DROP INDEX CONCURRENTLY` statements were converted to ordinary `CREATE/DROP INDEX` operations, because this initial baseline runs only against an empty database.
- Raw PostgreSQL partial unique indexes, foreign keys and custom body-measurements CHECK constraints are retained.
- This is a **historical SQL squash**, not a newly generated minimal Prisma diff. It intentionally contains redundant transitional DDL that is harmless on an empty database.

## Required clean database setup

Never run this new baseline on a database that already has migrations from `gym-api-nestjs`; it would attempt to create tables that already exist. Local/test/staging DB instances must be **disposable** and rebuilt (remove only the intended local volume, or drop/recreate a dedicated test DB after confirming the target URL).

```sh
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:validate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:migrate:status
pnpm --filter @gym/api db:seed
```

CI tests must prove the baseline applies to a fresh PostgreSQL 17 instance and covers expected indexes and constraints. Do not merge until the API e2e job and all required status checks pass.

## Release compatibility boundary

Previously signed, pre-reset migration images are **not forward-upgrade-compatible** with this baseline. Any two-release staging exercise must use two releases both created after this reset. No existing production database was reset by this PR. Do not use `prisma migrate resolve` to conceal an actual schema mismatch.

Once the first live database is established, migration history becomes immutable. Add one incremental, forward-only migration for every subsequent schema change. Never squash it again without a separate data migration and explicit approval.
