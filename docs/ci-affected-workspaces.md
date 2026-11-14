# CI: affected workspaces and required checks

Pull requests use a conservative change selector in `scripts/ci-select.mjs`.
The selector compares the PR head against its merge-base with `main`, using
complete Git history (`actions/checkout` with `fetch-depth: 0`).

## Pull request routing

| Changed files                                          | Quality checks                       | API E2E / coverage / Docker | Vulnerability audit                    |
| ------------------------------------------------------ | ------------------------------------ | --------------------------- | -------------------------------------- |
| `apps/api/**`                                          | API                                  | Yes                         | If the API package manifest changed    |
| `apps/web/**`                                          | Web                                  | No                          | If the Web package manifest changed    |
| `apps/mobile/**`                                       | Mobile                               | No                          | If the Mobile package manifest changed |
| `packages/api-client/**`                               | API client + Web + Mobile            | No                          | If the client package manifest changed |
| `apps/api/openapi/**`                                  | API + client + Web + Mobile          | Yes                         | No                                     |
| `docs/**`, root `*.md`                                 | Prettier formatting + required gates | No                          | No                                     |
| Root lockfile, root config, CI, infra or unknown files | All workspaces                       | Yes                         | Yes                                    |

For mixed PRs, all relevant workspaces run. Unknown paths, empty diffs, missing
commits and cross-cutting files must never silently bypass API checks.

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
