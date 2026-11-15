# CI: affected workspaces and required checks

Pull requests use a conservative change selector in `scripts/ci-select.mjs`.
The selector compares the PR head against its merge-base with `main`, using
complete Git history (`actions/checkout` with `fetch-depth: 0`).

## Pull request routing

| Changed files                                                  | Quality checks                       | API E2E / coverage / Docker | Vulnerability audit                    |
| -------------------------------------------------------------- | ------------------------------------ | --------------------------- | -------------------------------------- |
| `apps/api/**`                                                  | API                                  | Yes                         | If the API package manifest changed    |
| `apps/web/**`                                                  | Web                                  | No                          | If the Web package manifest changed    |
| `apps/mobile/**`                                               | Mobile                               | No                          | If the Mobile package manifest changed |
| `packages/api-client/**`                                       | API client + Web + Mobile            | No                          | If the client package manifest changed |
| `apps/api/openapi/**`                                          | API + client + Web + Mobile          | Yes                         | No                                     |
| `docs/**`, root `*.md`                                         | Prettier formatting + required gates | No                          | No                                     |
| Known app/client `README.md`, `apps/api/test/README.md`        | Prettier formatting + required gates | No                          | No                                     |
| `infra/**/*.md`                                                | Prettier formatting + required gates | No                          | No                                     |
| Root lockfile, root config, CI, non-doc infra or unknown files | All workspaces                       | Yes                         | Yes                                    |

For mixed PRs, all relevant workspaces run. Unknown paths, empty diffs, missing
commits and cross-cutting files must never silently bypass API checks.

Only **known documentation locations** are exempt: top-level `README.md` in
`apps/api`, `apps/web`, `apps/mobile` and `packages/api-client`, the API test
`README.md`, and Markdown files under `infra/` (including Docker runbooks).
Markdown files nested in application source directories still trigger that
app's checks; Markdown in unrecognized packages forces full CI. Changing an actual
`infra/` Compose file, init script or environment template, even alongside a
README, still forces full CI. Docs-only PRs retain the always-required Quality,
API E2E and Web integration **result gates**, which validate intentional skips.

The selector script itself (`scripts/ci-select.mjs`) and its tests remain
cross-cutting changes: a PR modifying the classifier runs the full CI matrix,
including the Redis upgrade rehearsal. Every push to `main` also still runs
all checks, even if it only changes documentation.

The root `pnpm-lock.yaml` is deliberately a global invalidation boundary:
dependency changes may affect any workspace, so full CI runs.

## Required status checks and release safety

- Every push to `main` and manual CI dispatch runs all jobs. This preserves
  the exact-commit release/GHCR eligibility requirement.
- `Quality / Node 24` remains the always-running required branch check and
  fails if change classification fails.
- `API e2e / PostgreSQL 17` remains the required status check, but now acts
  as a result gate. For API-impacting PRs, it requires a successful real
  `API e2e suite / PostgreSQL 17` job. For frontend/docs-only PRs, it
  verifies that the suite was intentionally skipped, not cancelled or failed.
- API coverage, Docker, migration, operational, observability, staging and
  readiness jobs run only for API-impacting PRs (and all main pushes).
- Dependency audits run when package manifests change or changes are shared.

## Verify locally

Run `node --test scripts/ci-select.test.mjs` for routing unit tests.
The `CI / Determine affected workspaces` step records the selected scope
in the GitHub Actions job log.

The CI refactor does not change `main` protection rules or automatic
publishing. Deployment and release approval remain separate workflows.

## Build caching and removal of duplicate tests

The `Quality / Node 24` job now restores the Turborepo task cache
(`.turbo/cache`) and Next.js incremental cache (`apps/web/.next/cache`)
using `actions/cache@v6`. Keys are scoped to the operating system,
Node.js version, lockfile, workspace manifests, Turborepo configuration
and commit SHA. A restore prefix permits reusing safe prior build artifacts
within the same dependency configuration. The existing
`actions/setup-node@v7` pnpm-store cache remains in place.

Only build caches are stored. Dependencies (`node_modules`), Prisma
generated files, credentials, test databases and coverage reports are
never added to the build cache.

API unit tests already run with coverage thresholds in
`API Coverage / Critical modules`. The Quality job runs Web, Mobile
and API Client tests without running the same API unit tests twice.
The protected `API e2e / PostgreSQL 17` check **requires both** the
real PostgreSQL E2E suite and API coverage to succeed when API files
are affected; it fails if either fails or is missing.

Workspace test tasks are marked `cache: false` in `turbo.json` so
tests always execute on pushes to `main`. Builds, lint and typechecks
may reuse correctly hashed Turborepo results. The vulnerability audit
does not restore the pnpm package store because it only reads the
lockfile and queries the registry.
