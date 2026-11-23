# ADR-006 — Shared package ownership and cross-runtime boundaries

- **Status:** Proposed for owner review (Issue [#370](https://github.com/sauron9521/gym-platform/issues/370)); no product/security GO
- **Date:** 2026-11-23
- **Scope:** M03 / E16; [architecture roadmap #380](https://github.com/sauron9521/gym-platform/issues/380), [shared adoption #319](https://github.com/sauron9521/gym-platform/issues/319)
- **Baseline:** checked `main` application and shared-package manifests plus current public entrypoints; **declared consumers** below are manifest dependencies, not proof of usage in every screen

## Decision

Keep **six independent apps** and the **five existing shared packages**. Each app owns its features, routes, runtime authentication, UX flows and deployment. `apps/api` remains the only backend authority for database writes, ownership, permissions, locking and server-side business transitions. Packages must not import app implementations. No duplicate `contracts`, `utils`, `validation` or native UI package without an independently justified consumer and ownership decision.

Promote code only when two real consumers share the same stable behavior **or** a narrowly defined, tested cross-runtime abstraction has been approved. Prefer app-local code until that condition is met. In particular, do not move Prisma models, Nest providers, Next server actions, session storage or native UI into platform-neutral packages.

## Package ownership and compatibility matrix

| Package | Owns / public interface | Declared app consumers | Runtime boundary |
| --- | --- | --- | --- |
| `@gym/api-client` | OpenAPI-generated types; `openapi-fetch` transport; browser-cookie and native-bearer adapters; HTTP failure classification | `web`, `trainer`, `admin`, `mobile` | Uses standard Fetch interfaces; no Prisma, Node secrets, token persistence or automatic retry. Browser and native auth modes are explicit. Next SSR cookie forwarding remains app-local and deliberate. |
| `@gym/domain` | Pure, deterministic workout status, transition precondition and set-progress helpers | `mobile` **only** (declared today) | No framework or runtime dependencies. API validates permissions and writes independently. Keep small until a second real consumer adopts it; this is a deliberate limited cross-runtime contract, not permission to extract a duplicate domain layer. |
| `@gym/i18n` | Ukrainian/English ICU catalogs, typed keys, locale negotiation and lazy catalog loading | `web`, `trainer`, `admin`, `landing`, `mobile` | Framework-neutral messages. Next uses `next-intl`, Expo uses `react-intl` in their own adapters. API error codes stay locale-neutral. |
| `@gym/design-tokens` | Semantic theme palette, CSS and explicit native color adapter | `web`, `trainer`, `admin`, `landing`, `mobile` | CSS entrypoints are web-only; `./native` and `./ovranto-native` are native-specific. Do not import both legacy and OVRANTO root CSS stylesheets together. |
| `@gym/ui-web` | React Web UI primitives: Button, Input, Card, BrandLogo, AsyncFeedback | `web`, `trainer`, `admin`, `landing` | Browser/Next React UI only. **Forbidden in Expo**. No business forms, data fetching, app navigation or native widgets. |

The API does not declare a direct dependency on any of these five packages in its manifest. `scripts/ci-select.mjs` conservatively includes API checks for i18n catalog edits because of transactional email concerns; **CI selection is not equivalent to a package import**.

### Declared workspace dependency graph

```text
apps/web ──────────┬──> @gym/api-client
apps/trainer ───────┤
apps/admin ─────────┤
apps/mobile ────────┘

apps/web ──────────┬──> @gym/i18n, @gym/design-tokens, @gym/ui-web
apps/trainer ───────┤
apps/admin ─────────┤
apps/landing ───────┘

apps/mobile ───────────> @gym/i18n, @gym/design-tokens, @gym/domain

apps/api ──────────────> (no declared @gym shared-package dependency)

@ gym shared packages ─> (no declared intra-workspace package edges at baseline)
```

In the last line, `@ gym` is a human-readable group label, not a package specifier. No app-to-app manifest edge or shared-package cycle appears in the reviewed manifests. Native and browser consumers share contracts/tokens, **not** the same UI implementation.

## Import and ownership rules

1. **No app → app dependencies.** No package.json dependency on another app and no direct `@gym/<app>` or relative cross-app source import. Reuse shared package APIs instead.
2. **No package → app dependencies.** Packages depend only on their own code, stable external dependencies and, where necessary, other public shared package exports.
3. **No shared-package cycles.** Keep package dependency graph acyclic. Prefer explicit named/subpath exports; avoid deep imports into another package's `src`.
4. **Platform-neutral first, platform-specific at the edge.** `domain`, `i18n` and API transport should not import React, Nest or device storage; web UI may depend on React but never React Native.
5. **Security belongs to API.** Shared workout rules are UX preconditions; they never authorize writes, override transaction locks or bypass tenancy.
6. **Avoid new global state systems or automatic HTTP write retries.** TanStack Query can be used in consuming apps, with idempotency/reconciliation decisions scoped to each operation.
7. **Coordinate shared changes.** A contract, token or catalog change requires testing every declared consumer and the affected CI matrix. Update generated OpenAPI types in the same API contract PR.

## Verification and limits

Run:

```sh
node scripts/check-workspace-boundaries.mjs
pnpm test:tooling
pnpm --filter @gym/api-client test
pnpm --filter @gym/design-tokens test
pnpm --filter @gym/i18n test
```

The new guard covers direct dependencies in all workspace manifests, cycles among shared packages, and *literal* source imports under `apps/*/src` and `packages/*/src` that reach another app or import an app package. It does **not** resolve arbitrary computed imports, every alias or imports from `scripts/`; code review and existing API AST guards remain necessary. Keep any future extension deliberate rather than claiming a complete import graph.

Unit fixtures exercise valid imports, app-to-app manifest imports, app-to-app source imports, package-to-app source imports and package cycles. GitHub CI provides the repository-wide verification; this ADR is not evidence of device-level tests or production readiness.

## Follow-up ownership

- [#371](https://github.com/sauron9521/gym-platform/issues/371): adopt shared runtime API adapters without an alternate fetch client.
- [#372](https://github.com/sauron9521/gym-platform/issues/372): Trainer adoption of existing i18n/tokens/ui-web, including Light/Dark and a11y.
- [#374](https://github.com/sauron9521/gym-platform/issues/374): refine affected-workspace CI coverage and measure impact.
- [#360](https://github.com/sauron9521/gym-platform/issues/360): tighten Nest feature-to-feature imports using explicit facades, separately from workspace rules.
- [#373](https://github.com/sauron9521/gym-platform/issues/373): Trainer Mobile remains a design-only decision; no second native UI package yet.

Do not close #370 until the owner reviews this ADR, the tests and the PR's CI evidence. Merge is manual.
