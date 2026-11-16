# FSD shared-layer import boundaries

Frontend ESLint checks enforce a one-way boundary for absolute `@/` imports
from `src/shared`:

- Next Web, Landing and Admin: shared cannot import `entities`, `features`,
  `widgets`, `pages` or `app`.
- Expo Mobile: shared cannot import `entities`, `features`, `widgets`,
  `screens` or `app`.

Both package-barrel imports (for example, `@/features`) and nested imports
(for example, `@/features/some-feature`) are forbidden. Shared-to-shared
imports and third-party dependencies remain allowed.

The existing ESLint commands enforce these checks in affected CI.

This is an incremental rule, **not** a complete dependency graph validator.
Relative traversals and cross-feature imports need a later resolver-aware rule;
this guard alone does not prove full FSD compliance.
