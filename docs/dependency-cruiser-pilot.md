# Dependency-cruiser pilot: architecture boundaries

Run pnpm architecture:cruise to inspect application and package source files. It checks cross-app imports, app imports from shared packages, relative cross-workspace imports, and relative cross-feature API imports.

This is a **manual pilot**, available locally and through the on-demand Tooling audit GitHub Actions workflow. It is not a replacement for required CI checks. Compare its results with the API architecture:check, architecture:deps and workspace-boundaries contract tests.

Rules live in .dependency-cruiser.cjs. Dependency-cruiser resolves import targets instead of matching import-like strings. Generated code, tests and E2E sources are excluded. The pilot **does not** yet replace package manifest rules, Nest DI/provider registration, API public contract checks, alias conventions, or computed dynamic import guards. Existing scripts still enforce those invariants.

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
