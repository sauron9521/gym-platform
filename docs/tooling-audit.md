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

The Knip config disables only the **Admin Playwright plugin** because its
real-API and staging config files require protected runtime environment
variables at import time. Those configuration files and E2E specs are still
listed as **static entrypoints** for analysis. Actual browser tests and
protected staging smoke are unaffected.

## Observed starting point (main, November 2026)

A clean isolated checkout, with Prisma Client generated, reported a nonzero
number of potentially unused files, exports and dependencies. Some findings
include real Web Playwright integration specs and generated or platform-specific
modules, so **Knip findings are not verified deletions**.

A Turborepo dry-run of `lint typecheck build` planned **33 tasks across 11
workspaces** (11 each for lint, typecheck and build). This is a graph plan, not
runtime cost or a measurement of affected-only CI.

## Manual GitHub workflow

Run **Tooling / Knip and Turborepo baseline (manual)** from the Actions tab
on a reviewed `main` commit. It uses read-only GitHub permissions, generates
only a local Prisma Client, creates Knip and Turbo diagnostic artifacts,
prints a summary and retains evidence for seven days. It is not a deployment
or production-readiness approval.

For a complete inventory of the current top-level `scripts/` modules, their
replacement candidates and safety gates, see the [custom script replacement
audit](custom-scripts-replacement-audit.md).

## Next safe steps

1. Review the Knip baseline by workspace, confirm real entrypoints and
   generated files, and narrow false positives with explicit configuration.
2. Validate actual dependency removals one at a time with relevant tests.
3. Compare `turbo run <task> --affected --dry=json` plans to the existing
   conservative `ci-select.mjs` scope matrix on representative PR changes.
4. Only after parity is demonstrated consider replacing affected selection or
   enabling a narrowly scoped blocking Knip rule. Keep required Quality, API
   and Web E2E gates unchanged during the pilot.
