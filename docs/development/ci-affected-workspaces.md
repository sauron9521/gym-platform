# CI: affected workspaces and required checks

Pull requests use a conservative change selector in `scripts/ci-select.mjs`.
The selector compares the PR head against its merge-base with `main`, using
complete Git history (`actions/checkout` with `fetch-depth: 0`).

## Pull request routing

The table describes the explicit application/client scopes returned by the selector. Shared package checks and Turbo task dependencies may add work beyond these scopes. Root tooling contracts, formatting and i18n catalog tests run even for documentation-only changes.

| Changed files                                                                      | Selected scopes                           | API E2E / coverage / Docker | Vulnerability audit                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------- | ------------------------------------------------ |
| `apps/api/**`                                                                      | API                                       | Yes                         | On API manifest change                           |
| `apps/web/**`                                                                      | Athlete Web                               | No                          | On Web manifest change                           |
| `apps/landing/**`                                                                  | Landing                                   | No                          | On Landing manifest change                       |
| `apps/admin/**`                                                                    | Admin                                     | No                          | On Admin manifest change                         |
| `apps/trainer/**`                                                                  | Trainer                                   | No                          | On Trainer manifest change                       |
| `apps/mobile/**`                                                                   | Mobile                                    | No                          | On Mobile manifest change                        |
| `packages/api-client/**`                                                           | Client, Web, Admin, Trainer, Mobile       | No                          | On client manifest change                        |
| `packages/ui-web/**`                                                               | Web, Admin, Trainer, Landing              | No                          | On UI manifest change                            |
| `packages/design-tokens/**`                                                        | Web, Admin, Trainer, Landing, Mobile      | No                          | On tokens manifest change                        |
| `packages/i18n/**`                                                                 | All six apps (API uses mail translations) | Yes                         | On i18n manifest change                          |
| `tooling/config/**`                                                                | Web, Admin, Trainer, Landing              | No                          | No, unless package manifest changes (full scope) |
| `apps/api/openapi/**`                                                              | API, Client, Web, Admin, Trainer, Mobile  | Yes                         | No                                               |
| Known documentation paths (see below)                                              | No application scopes                     | No                          | No                                               |
| Root lockfile, root config, CI, non-doc infra, `packages/domain/**`, unknown paths | Full                                      | Yes                         | Yes                                              |

For mixed PRs, selected scopes are unioned. Landing is not an OpenAPI consumer. Empty diffs select full scope; invalid or unavailable base/head commits fail classification, and required result gates fail closed. Renames are compared as deletion and addition, so both old and new paths contribute to scope.

The documentation exemptions are `docs/**`, root Markdown files, `infra/**/*.md`, the top-level README in API, Athlete Web, Trainer, Landing, Mobile and API Client, and `apps/api/test/README.md`. Admin README is not currently exempt. Other app-local Markdown selects that application; unknown package paths fall back to full checks. Exemptions are applied to each path, not the entire mixed PR.

The separate Web integration workflow runs four real-API browser shards when full, API, Web, Trainer or client scope is selected. Its stable result gate remains present even for intentional skips. Admin and Landing have separate browser checks inside CI; Mobile Metro and native manual testing remain distinct.

The selector and CI configuration are cross-cutting paths. The Redis upgrade rehearsal runs on PRs touching `infra/docker/compose.yaml`, `scripts/test-redis-upgrade.sh`, `scripts/ci-select.mjs` or `.github/workflows/ci.yml`; it is not an unconditional main-push job. Main pushes and manual dispatch retain full workspace and release-source verification.

## Required status checks and release safety

- Every push to `main` and manual CI dispatch selects full scope. The Redis upgrade rehearsal remains PR-specific. This preserves
  the exact-commit release/GHCR eligibility requirement.
- `Quality / Node 24` remains the always-running required branch check and
  fails if change classification fails.
- `API e2e / PostgreSQL 17` remains the required status check, but now acts
  as a result gate. For API-impacting PRs, it requires both the real
  `API e2e suite / PostgreSQL 17` and API coverage to pass. For frontend/docs-only PRs, it
  verifies that both jobs were intentionally skipped, not cancelled or failed.
- API coverage, Docker, migration, operational, observability, staging and
  readiness jobs run only for API-impacting PRs (and all main pushes).
- Dependency audits run for package manifests and cross-cutting changes;
  source-only changes in known shared packages do not require an audit.

## Verify locally

Run `pnpm test:tooling scripts/ci-select.test.mjs` from the repository root for routing unit tests.
The `CI / Determine affected workspaces` step records the selected scope
in the GitHub Actions job log.

The CI refactor does not change `main` protection rules or automatic
publishing. Deployment and release approval remain separate workflows.

## Build caching and removal of duplicate tests

The `Quality workspaces / Node 24` job restores the Turborepo task cache
(`.turbo/cache`) and Next.js incremental caches for Web, Landing, Admin and Trainer
using `actions/cache@v6`. Keys are scoped to the operating system,
Node.js version, lockfile, workspace manifests, Turborepo configuration
and commit SHA. Restore prefixes allow reuse within the same dependency configuration and then across older dependency configurations; Turbo and Next.js validate their own cache inputs. The existing
`actions/setup-node@v7` pnpm-store cache remains in place.

Only build caches are stored. Dependencies (`node_modules`), Prisma
generated files, credentials, test databases and coverage reports are
never added to the build cache.

API unit tests already run with coverage thresholds in
`API Coverage / Critical modules`. The workspace quality job runs the selected frontend/client tests (and Domain in full scope) without repeating API unit coverage.
The protected `API e2e / PostgreSQL 17` check **requires both** the
real PostgreSQL E2E suite and API coverage to succeed when API files
are affected; it fails if either fails or is missing.

Workspace test tasks are marked `cache: false` in `turbo.json` so
tests always execute on pushes to `main`. Builds, lint and typechecks
may reuse correctly hashed Turborepo results. The vulnerability audit
does not restore the pnpm package store because it only reads the
lockfile and queries the registry.

## Parallel fast feedback

The expensive workspace formatting, lint, typecheck, tests, and build run in the
`Quality workspaces / Node 24` job as soon as change classification succeeds.
The existing branch-protected `Quality / Node 24` name remains the result gate:
it fails closed unless workspace quality, security audit, Windows checks,
Mobile Metro, Web fixture-browser, Admin/Landing browser and API operations jobs all have their expected results.
The required API and real-API browser gates remain independent and unchanged.
This split does **not** skip tests or change release-source CI requirements.

## Policy selector versus Turborepo affected

The current CI uses explicit Turbo filters chosen from the conservative selector, not `turbo --affected` as a replacement. Shared UI typecheck is included whenever Web scope is selected, and i18n is included for frontend scopes. The selector has policy obligations that a task graph alone cannot infer (security, database, operational and release checks).

The [observed Turbo shadow audit](../turbo-affected-shadow-evidence-2026-11-24.md) found a cross-cutting change that selected zero Turbo packages while the policy required seven application/client workspaces. Direct replacement remains NO-GO. Use the [manual tooling audit](tooling-audit.md) for further diagnostic comparisons without changing protected checks.
