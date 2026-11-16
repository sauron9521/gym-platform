# FSD shared-layer import boundaries

Frontend lint checks now enforce a one-way boundary for absolute `@/` imports
from `src/shared`:

- Next Web, Landing and Admin: shared must not import features, widgets or app.
- Expo Mobile: shared must not import features, screens or app.

These restrictions are enforced by the existing ESLint commands in affected CI.
They do not ban third-party packages or shared-to-shared imports.

This is the first incremental rule, not a complete dependency graph validator.
Relative traversals and cross-feature imports require a later resolver-aware rule;
do not treat this rule alone as proof of full FSD compliance.
