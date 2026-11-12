# Gym Platform API — migration foundation

This folder stages the existing NestJS API from https://github.com/sauron9521/gym-api-nestjs
for a gradual move into the pnpm/Turborepo monorepo.

## PR #5: Prisma baseline

- Imported all existing Prisma schema files and historical migrations without editing them.
- Kept the original Prisma 7 configuration and placeholder-only environment example.
- Recorded original Git blob hashes in migration-baseline.json.
- Added Node tests to ensure that the historical migrations stay unchanged.

Run: pnpm --filter @gym/api test

**This is not a running NestJS application yet.** Prisma generate, seed,
API build, and migration deployment are deliberately disabled in this phase.
The old standalone API remains the owner of production database changes.

## Next migration PRs

1. Move src, NestJS dependencies, Nest CLI, TypeScript, unit tests, and seed.
2. Restore Prisma generation, build, lint, typecheck and unit tests.
3. Add dedicated test PostgreSQL and HTTP/e2e CI.
4. Migrate Docker, monitoring, and deployment after staging validation.

Never reset or migrate the production database as part of this bootstrap PR.
