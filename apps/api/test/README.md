# API end-to-end and integration tests

The test root is `apps/api/test/`.

- `e2e/<module>/` — HTTP-level suites grouped by feature (`auth`, `body-measurements`, `exercises`, `trainer-athletes`, `users`, `workout-analytics`, `workouts`).
- `integration/<module>/` — database/provider suites grouped by feature (`auth`, `exercises`, `training-programs`, `users`, `workouts`).
- `e2e/common/` and `integration/common/` — cross-cutting HTTP security, rate limiting and principal isolation.
- `e2e/infra/` and `integration/infra/` — bootstrap, health, observability, OpenAPI and database index checks.
- `utility/` — shared fixtures and guarded disposable test database setup.
- The two root-level `*.test.mjs` files are invoked directly by CI/scripts and remain at their original paths.

Vitest discovers nested `test/**/*.e2e-spec.ts`; `fileParallelism: false` preserves the existing test concurrency policy.

## Legacy inventory integrity

`../migration-source-inventory.json` is a **frozen record of original imported paths**, not a file layout manifest. Never rewrite it simply to move tests. `relocations.json` maps an original path to its new physical test location for `scripts/api-migration-readiness.mjs`. Every mapping must be under `test/`, unique, safe and refer to an actual historical test path.

After moving a test, update its relative imports and this map, then run:

```sh
node --test scripts/api-migration-readiness.test.mjs
pnpm --filter @gym/api typecheck:e2e
pnpm --filter @gym/api test:e2e
```

Use the disposable `*_test` database described by `apps/api/.env.test.example`. Never run a test migration against an operational database.
