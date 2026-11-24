# Knip and Turborepo diagnostic pilot

This is a **report-only**, manually triggered audit. It does not change the
protected GitHub CI checks, delete dependencies, alter production code or execute
Turborepo build/test tasks. The existing `scripts/ci-select.mjs` continues to
fail closed on unknown or cross-cutting changes.

## Run locally

Use Node.js 24 and the repository's pinned pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gym/api db:generate
pnpm knip:report
pnpm --silent turbo:plan > turbo-plan.json
```

- `pnpm knip:report` scans the entire monorepo for candidates and intentionally
  exits successfully **only for lint findings**. Invalid configuration and
  internal Knip failures still exit nonzero.
- `pnpm knip` is a strict local audit. It exits nonzero when it finds issues;
  it is **not** wired into required CI while the baseline is being reviewed.
- `pnpm turbo:plan` prints machine-readable JSON for `lint`, `typecheck` and
  `build` tasks using `--dry=json`. It never executes those tasks.
- Do not run Knip `--fix` or delete packages based on its output without
  checking all runtime imports, manifests, platform-specific entrypoints,
  generated source and real E2E usage.

The Knip config disables automatic Playwright config loading in **Admin
and Web** because their real-API/staging/integration configs require protected
runtime environment variables or a disposable test database at import time.
Their Playwright configs and E2E specs are listed as **static entrypoints**:
Web includes both `e2e/specs/**/*.spec.ts` and
`e2e/integration/**/*.spec.ts`. This lets Knip follow imports from real
browser tests without executing database guards during the audit. Ordinary
Web/API/browser tests and protected staging smoke are unaffected.

The [first manual audit](https://github.com/sauron9521/gym-platform/actions/runs/45363672094)
reported **35 potentially unused files**; 19 were real Web integration
`*.spec.ts` files, with supporting fixtures and the integration Playwright
config also flagged. A temporary full Knip check in
[PR #706 CI](https://github.com/sauron9521/gym-platform/actions/runs/45368694507)
confirmed **14 unused-file findings** after the Web entrypoint configuration,
with none of those integration suites, fixtures or config among the findings.
The temporary diagnostic test is removed from the final PR; this is
**false-positive triage**, not proof that the remaining 14 files are dead
or permission to delete dependencies or enable blocking Knip rules.

## Observed starting point (main, November 2026)

A clean isolated checkout, with Prisma Client generated, reported a nonzero
number of potentially unused files, exports and dependencies. Some findings
include real Web Playwright integration specs and generated or platform-specific
modules, so **Knip findings are not verified deletions**.

A Turborepo dry-run of `lint typecheck build` planned **33 tasks across 11
workspaces** (11 each for lint, typecheck and build). This is a graph plan, not
runtime cost or a measurement of affected-only CI.

## Manual GitHub workflow

Run **Tooling / Knip, Turborepo, and dependency-cruiser (manual)** from the
Actions tab on a reviewed `main` commit. It uses read-only GitHub
permissions, generates only a local Prisma Client, creates Knip, dependency
boundary and Turbo diagnostic artifacts, prints a summary and retains evidence
for seven days. It is not a deployment or production-readiness approval.

The additional **Turbo affected shadow comparison** accepts optional
`base_sha` and `head_sha` inputs on the manual workflow. Leave **both empty**
to compare the latest checked-out `main` commit against its first parent
(`HEAD^1...HEAD`), or supply **both full 40-character commit SHAs** to
compare an earlier, nonempty range from the checked-out `main` history.
Git ancestry and reachability from the checked-out commit are validated before
running Turbo; shallow, unrelated, partial or identical ranges fail closed.
Run the workflow from the **main** branch, not an arbitrary unreviewed ref.

Both comparators use the exact same SHA range through `TURBO_SCM_BASE` and
`TURBO_SCM_HEAD`. The workflow fetches full Git history and writes
`turbo-affected-plan.json` and `turbo-affected-comparison.json` as artifacts,
with missing application/client packages in its summary. This runs **no
build, lint or test tasks** and never changes required CI routing, outputs or
branch protection.

For broader evidence from **one manual run**, set `history_samples` to 1–8
(default: `0`, disabled). The report-only comparison scans at most 80 recent
first-parent commits in the checked-out `main` history and selects up to the
requested number of **distinct change categories** (API, Web, Mobile, shared
packages, OpenAPI, docs, lockfile, cross-cutting or mixed changes).
Each selected commit is compared with its first parent using the existing
`ci-select.mjs` classifier and a separate `turbo --affected --dry=json`
plan. It writes `turbo-affected-history.json` and a summary of potential
missing application/client packages. Every comparison is bounded and performs
**no lint, typecheck or build work**. If Git history is insufficient or a
Turbo invocation fails, the diagnostic job fails rather than claiming parity.

A category appearing in the historical report is **not** proof of CI routing
parity for all PRs in that category. Current Turbo workspace definitions are
used for all historical ranges. Carefully inspect discrepancies and compare
with independent CI/E2E requirements before making any routing changes.

The JSON plan describes lint/typecheck/build task selection, **not** API
integration tests, release security checks or actual required-job scheduling.
Extra/missing packages indicate a difference to review, not proof that either
selector can safely replace the other. Historical ranges use the **current
checkout's** workspace configuration for the dry-run graph, not a rebuild of
the historical repository state. Treat old-range comparisons as exploratory
and use recent main commits when assessing parity. One run does not prove
parity across all PR classes; collect examples for API, Web, Mobile, OpenAPI,
shared packages, lockfiles, docs-only and mixed changes before a migration.

For a complete inventory of the current top-level `scripts/` modules, their
replacement candidates and safety gates, see the [custom script replacement
audit](custom-scripts-replacement-audit.md).

## Knip follow-up: restore missing Vitest coverage

After the [Web Playwright entrypoint fix](https://github.com/sauron9521/gym-platform/pull/706),
the verified Knip unused-file count was **14**, down from 35. Two kinds of
remaining findings exposed **real test-discovery gaps**, not dead source code:

- `packages/design-tokens/vitest.config.mts` included only
  `test/**/*.test.mjs`, omitting two existing `test/**/*.spec.mts` suites.
  Those suites check generated CSS/native palette parity, semantic colors and
  text contrast. The package's ordinary `pnpm test` now discovers both suffixes.
- `apps/web/vitest.components.config.mts` included only component
  `*.test.tsx`, omitting the existing
  `test/components/workout-set-mutation-feedback.test.ts` suite. The Web
  component test command now includes both `*.test.tsx` and `*.test.ts`.

The correct fix is to **run these tests**, not to delete them or merely suppress
Knip warnings. Confirm CI actually executes the newly discovered tests; any
test failures must be fixed within their owning workspace before this change
is eligible to merge. `packages/api-client/test/contract-types.test.ts`
remains a compile-time contract included in that package's `tsconfig.json`,
not a Vitest runtime test. Remaining unused-file findings require separate
review and should not be mass-deleted.

## Verified manual pilot result (2026-11-24)

[Manual run #45363672094](https://github.com/sauron9521/gym-platform/actions/runs/45363672094)
completed successfully, but its Turbo shadow comparison found a **seven-workspace
gap on workflow/tooling-only changes**: conservative CI correctly required a
full scan, while Turbo's source task graph selected zero packages. Five distinct
historical categories were available in the last 80 commits; API, Landing,
docs and one mixed/manifest category had no missing application/client
packages. **Full replacement of `ci-select.mjs` by Turbo affected is NO-GO.**

See the [evidence, exact SHA ranges, limitations and follow-up gates](turbo-affected-shadow-evidence-2026-11-24.md).
A successful manual diagnostic does not imply scope parity or authorize any
change to required CI.

## Next safe steps

1. Review the Knip baseline by workspace, confirm real entrypoints and
   generated files, and narrow false positives with explicit configuration.
2. Validate actual dependency removals one at a time with relevant tests.
3. Compare `turbo run <task> --affected --dry=json` plans to the existing
   conservative `ci-select.mjs` scope matrix on representative PR changes.
4. Only after parity is demonstrated consider replacing affected selection or
   enabling a narrowly scoped blocking Knip rule. Keep required Quality, API
   and Web E2E gates unchanged during the pilot.
