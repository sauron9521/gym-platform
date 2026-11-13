# API end-to-end and integration tests

The test root is `apps/api/test/`.

- `e2e/<module>/` — HTTP-level feature behavior (migration in progress).
  - `e2e/auth/` — auth registration/login, tokens and endpoint throttling HTTP tests.
- `integration/<module>/` — database/provider integration and contract tests.
- `utility/` — shared fixtures and guarded disposable test database setup.
- Root-level `*.e2e-spec.ts` files are legacy layout; migrate in focused PRs.
- Root-level `*.test.mjs` files may be invoked directly by CI/scripts; do not move them without updating each caller.

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
