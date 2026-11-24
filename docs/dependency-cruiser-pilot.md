# Dependency-cruiser pilot: architecture boundaries

Run pnpm architecture:cruise to inspect application and package source files. It checks cross-app imports, app imports from shared packages, relative cross-workspace imports, and relative cross-feature API imports.

This is a **manual pilot**, available locally and through the on-demand Tooling audit GitHub Actions workflow. It is not a replacement for required CI checks. Compare its results with the API architecture:check, architecture:deps and workspace-boundaries contract tests.

Rules live in .dependency-cruiser.cjs. Dependency-cruiser resolves import targets instead of matching import-like strings. Generated code, tests and E2E sources are excluded. The pilot **does not** yet replace package manifest rules, Nest DI/provider registration, API public contract checks, alias conventions, or computed dynamic import guards. Existing scripts still enforce those invariants.

Regression tests create temporary fixtures to show that invalid dependencies are rejected and same-workspace imports are accepted. These tests run with pnpm test:tooling.

Only remove an old script after migrating every required invariant, proving equivalence and preserving CI gating.
