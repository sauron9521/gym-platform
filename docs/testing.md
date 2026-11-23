# Gym Platform testing conventions

## Test runner

- Vitest 5 is the unit and contract test runner for API, Web, Landing, Admin,
  Mobile, shared packages and root `scripts/*.test.mjs`.
- Node-only contracts share `tooling/vitest/node.mjs` and use explicit include
  patterns in per-workspace config files. The mobile React Native component
  runner stays separate (`apps/mobile/vitest.config.mts` + `vitest-native`).
- API integration and HTTP E2E stay under `vitest.config.e2e.ts`; use a disposable
  test database. Browser E2E stays on Playwright. Native-device E2E uses Maestro.
- Write new tests with `import { test, expect } from 'vitest'`, or keep existing
  Node assert APIs when migrating; do not add new `node:test` imports.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm test:tooling
pnpm --filter @gym/api test
pnpm --filter @gym/api test:architecture
pnpm --filter @gym/api test:coverage-tools
pnpm --filter @gym/api test:contracts
pnpm --filter @gym/api-client test
pnpm --filter @gym/design-tokens test
pnpm --filter @gym/domain test
pnpm --filter @gym/web test
pnpm --filter @gym/landing test
pnpm --filter @gym/admin test
pnpm --filter @gym/mobile test
pnpm test
```

## CI safeguards and cost control

- The protected `Quality / Node 24` aggregator fails closed unless
  `Tooling contracts / Vitest Node 24` and workspace quality pass.
- Root release, rollback, backup, monitoring and CI-selection contracts run
  **once** in the tooling job instead of repeating in multiple API jobs.
  Specialized API jobs still validate shell syntax, infrastructure contracts,
  Docker images, Prometheus rules, migration baselines and database E2E.
- Windows pre-push tests also run on Windows, intentionally: platform-specific
  argument handling deserves its own regression check.
- Turborepo filters restrict workspaces for affected PRs. API unit coverage,
  browser integration, Mobile Metro and device-level checks remain separate
  where their environments or required gates differ.
- GitHub branch protection must continue requiring both CI/Quality and Web
  integration aggregate checks where applicable. No job here deploys to prod.

## Full CI test-script inventory

The root tooling test `scripts/ci-test-coverage.test.mjs` discovers every
`apps/*` and `packages/*` workspace declaring a `test` script. It fails if
that workspace no longer has a guaranteed test path in full `main` CI:

- Web, Mobile, Landing, Admin, Trainer, API Client, and Domain: explicit
  `turbo run test --filter=...` selections in the full quality regression.
- API: a separate, required `test:cov` job; API unit tests are not duplicated
  in the quality job.
- i18n: the unconditional catalog and ICU test step.
- Design Tokens: `pnpm build` currently runs its `build: pnpm test` script.
  This coupling is documented here, not recommended for new workspaces.

Changes under `packages/domain/**` currently fail closed to the full CI scope,
so Domain unit tests execute on both those PRs and every push to `main`.
Adding a new workspace `test` script without wiring an appropriate full-CI
test path will now fail the root tooling gate instead of being silently skipped.
This inventory does not imply that manually triggered Maestro or staging E2E
checks run in every PR.

## Safety

Keep tests deterministic and use `onTestFinished` for temp-resource cleanup
when using Vitest. Don't remove test assertions just to make a migration pass.
