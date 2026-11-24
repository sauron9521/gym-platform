# Workspace import boundaries: dependency-cruiser

Workspace source imports are enforced by dependency-cruiser's parsed JSON graph
in the **required** CI `Tooling contracts / Vitest Node 24` job. The former
regex-based source scanner has been removed from
`scripts/check-workspace-boundaries.mjs`; that script remains responsible for
manifest-based invariants and dependency-cycle checks.

## Required checks

- `pnpm test:tooling`: validates the workspace manifest checker, graph
  regression fixtures, CI configuration and other repository contracts.
- `pnpm architecture:cruise:boundaries`: loads a dependency-cruiser graph
  **once**, then rejects exact named application package imports and relative
  cross-workspace imports, including paths whose destination does not resolve.
- `node scripts/check-workspace-boundaries.mjs`: combines manifest checks and
  the parsed source graph for direct CLI use. Its exported
  `checkWorkspaceBoundaries(root)` checks **manifests only**, without source
  parsing. Do not confuse the exported function with the full CLI check.

The existing API architecture and NestJS provider/DI checks remain separate
required gates. No new dependency or CI job name is needed for this cutover.

## Standalone diagnostic commands

- `pnpm architecture:cruise:named`: inspect exact named application imports.
- `pnpm architecture:cruise:relative`: inspect relative workspace imports.
- `pnpm architecture:cruise`: dependency-cruiser's declarative rules for
  resolved cross-app, package and API feature dependencies.
- The on-demand Tooling audit workflow runs only the combined
  `architecture:cruise:boundaries` command for both named and relative
  imports and the resolved declarative-rule errors. When any resolved rule is
  violated, the command formats the **same JSON graph** with dependency-cruiser's
  native `depcruise-fmt -T err-long` reporter. It does not perform another
  source scan. Knip and the Turborepo dry run remain unchanged.
  `architecture:cruise`, `architecture:cruise:named` and
  `architecture:cruise:relative` are still available for local diagnosis.

The combined gate is authoritative for workspace source imports. Standalone
diagnostics are not a substitute for that required gate.

## Covered source and syntax

The graph includes workspace `src/` files under `apps/`, `packages/` and
`tooling/`, including `*.spec.ts`, `*.test.ts` and nested `test`,
`tests` and `e2e` directories. `node_modules`, `.next`, `.expo`, build
outputs, coverage and generated directories are excluded.

The required graph scanner reads literal import specifiers rather than
resolved destination paths alone. Regression fixtures cover unresolved
cross-workspace relative imports from:

- Static and side-effect imports, named/star re-exports
- Literal dynamic `import()` and CommonJS `require()`
- TypeScript `import type`, `export type` and TSX type-only imports
- Test files and test source directories
- Application package imports from those syntax forms

The old regex scanner reported false positives on import-like text inside
comments and strings. The graph scanner parses real dependencies instead.

## Checks retained in the manifest guard

`checkWorkspaceBoundaries(root)` still detects missing or duplicate workspace
package names, direct manifest dependencies on application workspaces across
dependency categories, and cycles between shared `packages/` and `tooling/`
workspaces. The manifest tests still run in required CI.

Other architecture checks, including NestJS DI/provider registration and
computed dynamic-import policy checks, remain independent. Nonliteral or
runtime-computed paths are not asserted as complete static graph coverage:
maintain their dedicated guards and review them before broadening this policy.

## Why the source scanner was retired

PRs #691–#697 introduced parsed import analysis, added coverage for unresolved
targets and test source files, promoted the combined graph to required CI, and
verified common syntax forms. This cutover removes only the now-duplicated
legacy relative-import regex and file walker. Manifest and dependency-cycle
checks stay in place.

Tests now prove that the **required graph** rejects invalid literal imports
instead of expecting a second regex implementation to reject them. Do not
reintroduce a duplicate source-text parser when a graph regression or rule
needs adjustment.
