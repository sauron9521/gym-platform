# Gym Platform API

NestJS 12 / Prisma 7 API, migrated from the existing standalone repository.

## Migration status

- Prisma multi-file schemas and **all original SQL migrations** are preserved.
- NestJS `src/`, unit tests, and e2e/integration test files have been imported.
- API configuration, Prisma seed, ESM package aliases, and pnpm dependencies are restored.
- The root monorepo CI generates Prisma, then runs format, lint, typecheck, unit tests and build.
- Database-backed integration/e2e tests and production deployment are **not enabled yet**.

## Local development

From the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api build
pnpm --filter @gym/api test
```

Start PostgreSQL separately, and create `apps/api/.env` based on `apps/api/.env.example`.
The sample environment sets API port `3001`, leaving port `3000` for Next.js.
Then run `pnpm --filter @gym/api dev`.

## Safety

Do not deploy this API or apply schema migrations against production until staging
has validated API parity, database configuration, and rollback procedures.
The standalone `gym-api-nestjs` repository remains the operational source of truth.

## Migration provenance

The API source and tests were imported from commit
`79e53bc1b7a78bb3856ff2aeab2529559240521e` of
`sauron9521/gym-api-nestjs`. The Prisma migration history baseline is tested
separately by `test/migration-baseline.test.mjs`.
