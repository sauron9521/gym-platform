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

## Static CI scanners (advisory pilot)

The path-scoped [Static CI analysis](../.github/workflows/static-ci-analysis.yml)
workflow runs on PRs and main pushes touching GitHub configuration or tracked
shell scripts; it also supports manual dispatch. It uses pinned tools:

- `actionlint 1.7.12` checks workflow syntax, expressions, and embedded bash/sh
  through the official container (which includes ShellCheck).
- `ShellCheck` inspects all tracked standalone `*.sh` files.
- `zizmor 1.32.0` scans workflow security in offline mode, without a GitHub
  token or additional repository permissions.

**Pilot limitation:** scanner steps use `continue-on-error: true`. Their
outcomes and warnings appear in the job summary, but a successful job is **not**
evidence of zero findings. Do not make this job required or remove existing CI
contracts until results are reviewed, findings fixed or individually justified,
and a follow-up PR switches the checks to enforcement.

Local equivalent (requires Docker, ShellCheck and uv):

```bash
docker run --rm --network none -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12 -shellcheck=shellcheck
git ls-files -z -- '*.sh' | xargs -0 -r shellcheck --severity=warning --
uvx "zizmor@1.32.0" --offline --collect=workflows --strict-collection --format=github .
```

## Checkout credential hardening

Read-only GitHub Actions jobs should use `actions/checkout` with
`persist-credentials: false`, so the short-lived GitHub token is not left in
Git configuration for subsequent build, test or script steps.

The CI, Web Integration E2E, scheduled Dependency Audit, Mobile Native E2E,
OVRANTO Visual Review and manual Staging Live Smoke workflows enforce this
for every checkout. The root tooling contract
`scripts/ci-checkout-credentials.test.mjs` checks each of their checkout steps
and fails if the setting is removed or a new unprotected checkout is added.
Full-history checkout still uses `fetch-depth: 0` for safe PR comparisons.

Do not apply this blindly to a workflow that must perform authenticated Git
writes. Those workflows need an explicit, narrowly scoped credentials strategy.
The zizmor advisory pilot continues to report other workflow findings for
separate review.

## Safety

Keep tests deterministic and use `onTestFinished` for temp-resource cleanup
when using Vitest. Don't remove test assertions just to make a migration pass.
