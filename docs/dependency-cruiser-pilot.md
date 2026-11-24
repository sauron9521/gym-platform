# Dependency-cruiser pilot: architecture boundaries

Run pnpm architecture:cruise to inspect application and package source files. It checks cross-app imports, app imports from shared packages, relative cross-workspace imports, and relative cross-feature API imports.

This is a **manual pilot**, available locally and through the on-demand Tooling audit GitHub Actions workflow. It is not a replacement for required CI checks. Compare its results with the API architecture:check, architecture:deps and workspace-boundaries contract tests.

Rules live in .dependency-cruiser.cjs. Dependency-cruiser resolves import targets instead of matching import-like strings. Generated code, tests and E2E sources are excluded. The pilot **does not** yet replace package manifest rules, Nest DI/provider registration, API public contract checks, alias conventions, or computed dynamic import guards. Existing scripts still enforce those invariants.

Regression tests create temporary fixtures to show that invalid dependencies are rejected and same-workspace imports are accepted. These tests run with pnpm test:tooling.

Only remove an old script after migrating every required invariant, proving equivalence and preserving CI gating.

## Workspace-boundary parity and legacy coverage

The workspace policy now includes **all pnpm workspace locations**: apps/*, packages/*, and tooling/*. The legacy workspace checker keeps ownership of manifest-only invariants; dependency-cruiser tests the source import graph:

| Invariant                                                | Legacy workspace checker | dependency-cruiser |
| -------------------------------------------------------- | ------------------------ | ------------------ |
| Cross-app source imports                                 | Enforced                 | Enforced           |
| Relative imports across app, package, tooling            | Enforced                 | Enforced           |
| Imported app by workspace package name                   | Enforced                 | Not yet covered    |
| Direct workspace manifest dependency on an app           | Enforced                 | Not covered        |
| Duplicate or unnamed workspace package                   | Enforced                 | Not covered        |
| Cyclic shared dependency declarations, including tooling | Enforced                 | Not covered        |
| Nest DI provider exports / feature contracts             | Separate API guard       | Not covered        |
| Arbitrary computed imports                               | Separate API guard       | Not covered        |

pnpm test:tooling runs source-boundary parity fixtures against both checkers, in addition to the existing manifest tests. This comparison checks only *resolved* imports in representative fixtures; the legacy manifest and DI guards remain required, and the new analyzer is still manual-only.

A later PR can consider removing the regex import extraction from the legacy workspace checker only after verifying named-package imports, unresolved path cases, and the behavior on CI against the complete source graph. This PR does **not** remove that extraction.
