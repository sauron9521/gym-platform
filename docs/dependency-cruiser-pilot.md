# Dependency-cruiser pilot: architecture boundaries

Run pnpm architecture:cruise to inspect application and package source files. It checks cross-app imports, app imports from shared packages, relative cross-workspace imports, and relative cross-feature API imports.

This is a **manual pilot**, available locally and through the on-demand Tooling audit GitHub Actions workflow. It is not a replacement for required CI checks. Compare its results with the API architecture:check, architecture:deps and workspace-boundaries contract tests.

Rules live in .dependency-cruiser.cjs. Dependency-cruiser resolves import targets instead of matching import-like strings. Generated code and build outputs remain excluded; test files and E2E folders within workspace source trees are now included. The pilot **does not** yet replace package manifest rules, Nest DI/provider registration, API public contract checks, alias conventions, or computed dynamic import guards. Existing scripts still enforce those invariants.

Regression tests create temporary fixtures to show that invalid dependencies are rejected and same-workspace imports are accepted. These tests run with pnpm test:tooling.

Only remove an old script after migrating every required invariant, proving equivalence and preserving CI gating.

## Workspace-boundary parity and legacy coverage

The workspace guard now checks all three pnpm workspace roots: `apps/`, `packages/`, and `tooling/`. Dependency-cruiser is still a manual diagnostic.

- **Both checkers:** cross-app source imports and relative cross-workspace source imports, including tooling packages.
- **Required dependency-cruiser check:** exact named application package imports.
- **Legacy checker only:** unresolved relative cross-workspace imports, manifest dependencies on apps, duplicate or missing workspace names, and shared dependency cycles.
- **API-specific guards:** Nest DI/provider exports, feature contract rules, and computed dynamic imports.

The parity tests run both import checkers against the same temporary source fixtures. These tests cover representative resolved imports; the legacy manifest and Nest DI guards remain required.

A future PR may remove the regex import extraction from the legacy checker after separately verifying named-package imports, unresolved paths and CI behavior across the whole codebase. This PR does not remove it.

## Named imports of application workspaces

The manual audit also runs `pnpm architecture:cruise:named` to detect imports such as
`import '@gym/api'` from application or shared-package source files. It reads the
literal `module` names from dependency-cruiser's machine-readable JSON graph and
looks up application package names from `apps/*/package.json`.

This deliberately **does not re-parse TypeScript source with a regular expression**.
In particular, unresolved imports remain observable in the JSON graph; filtering
it to resolved source targets alone would silently discard those edges. The rule
matches exact workspace application package names (the legacy contract); shared
packages remain legal. Import-like text in comments or strings is not an import.

The named-import check is now enforced by the required Tooling contracts job in CI.
The workspace guard retains manifest checks and unresolved relative-path protection;
its CLI also runs the named-import checker. The regex parser is retained only for
relative-path protection until a separate parity-tested migration.

## Unresolved relative imports: parity pilot

Run `pnpm architecture:cruise:relative` to inspect original relative import
specifiers from the dependency-cruiser JSON graph. The checker reconstructs
the source-relative destination, then checks whether that destination belongs
to a different manifest-backed workspace under `apps/`, `packages/` or
`tooling/`. It detects imports into another workspace even when the
destination file is missing or its import cannot be resolved.

The regression suite compares the graph result with the existing
`check-workspace-boundaries.mjs` for unresolved cross-app, app-to-package,
package-to-tooling, and tooling-to-app imports. It also tests permitted
same-workspace and public-package imports.

**Deliberately report-only:** dependency-cruiser now parses `*.spec.ts`,
`*.test.ts`, and files in workspace `src/test`, `src/tests` and
`src/e2e` directories. Regression fixtures confirm both literal named
application imports and unresolved cross-workspace relative imports in these
paths. The report-only comparison still does **not** establish full parity for
all syntax forms, generated code, computed dynamic imports, or false positives
from the legacy regular expression (e.g. import-like text inside strings).
**Do not remove** the required relative-path scanner or promote the parity
pilot to a required gate until these differences are reviewed.
The named-import CI gate and manifest/cycle checks remain unchanged.

## Combined required workspace-import graph gate

`pnpm architecture:cruise:boundaries` runs dependency-cruiser **once** to check
both exact application package imports and cross-workspace relative imports,
including unresolved import targets and test source. The existing required
`Tooling contracts` job uses this combined command instead of invoking the
named-app-only command. The standalone `architecture:cruise:named` and
`architecture:cruise:relative` commands remain available for diagnosis.

The legacy workspace checker still enforces manifest dependencies, duplicate
and missing package names, shared-package cycles, and its conservative regex
relative-import check in the required tooling tests. This deliberate overlap
prevents regressions while we validate syntax coverage and differences between
the parser-based and regex-based scanners. The combined graph gate is **not**
proof that the legacy parser can now be deleted: import-like strings can cause
false positives in the legacy script, and the computed dynamic-import/Nest
architecture guards remain separate.

## Syntax equivalence: cutover checklist

The required combined graph gate and independent legacy regex scanner stay
enabled while we validate source-syntax parity. The focused regression suite
`dependency-cruiser-syntax-parity.test.mjs` checks both analyzers against
unresolved relative imports from static imports, side-effect imports,
named/star re-exports, literal dynamic `import()`, CommonJS `require()`,
TypeScript `import type` and `export type`, and `tsx` type-only imports.
It also checks the named-app rule for the corresponding import forms.

An import-like string or comment is **not** an import; the legacy regular
expression can report a false positive in those cases, whereas the parsed
graph does not. The tests record this difference rather than accepting the
legacy false positive as an invariant.

Retirement criteria for the legacy relative-path parser:
1. Required combined graph gate remains green with source tests included.
2. All literal import forms and unresolved cross-workspace paths are covered.
3. The workspace-manifest, shared-dependency-cycle and Nest DI checks remain
   in required CI after code removal.
4. Any remaining gaps (computed dynamic imports, syntax parser diagnostics,
   generated source exemptions) are either covered by a separate existing
   guard or explicitly resolved.

These tests support a later, separate removal PR; they do not remove or
disable the legacy scanner.
