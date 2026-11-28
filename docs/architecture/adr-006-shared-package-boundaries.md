# ADR-006 — Shared package ownership and cross-runtime boundaries

- **Status:** Accepted direction, 2026-11-28 (SP01–SP10); implementation acceptance pending [#370](https://github.com/sauron9521/gym-platform/issues/370); no product/security GO
- **Date:** 2026-11-23
- **Scope:** M03 / E16; [architecture roadmap #380](https://github.com/sauron9521/gym-platform/issues/380), [shared adoption #319](https://github.com/sauron9521/gym-platform/issues/319)
- **Baseline:** manifest and export inventory at `48e92a9f3c0a920caa349a5c5f22c55543bf72ca` (2026-11-28); **declared consumers** below are manifest dependencies, not source-level usage or runtime acceptance.
- **Policy:** [Shared Packages Strategy v1.0](../product-strategy/shared-packages-strategy-v1.md); [SP10 approval](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235521401).

## Decision

Keep **six independent apps** and the **six existing shared packages**. The original five-package baseline was extended by datetime on 2026-11-27; the matrix below supersedes the original manifest snapshot. Each app owns its features, routes, runtime authentication, UX flows and deployment. `apps/api` remains the only backend authority for database writes, ownership, permissions, locking and server-side business transitions. Packages must not import app implementations. No duplicate `contracts`, `utils`, `validation` or native UI package without an independently justified consumer and ownership decision.

Promote code only when two real consumers share the same stable behavior **or** a narrowly defined, tested cross-runtime abstraction has been approved. Prefer app-local code until that condition is met. In particular, do not move Prisma models, Nest providers, Next server actions, session storage or native UI into platform-neutral packages.

## Package ownership and compatibility matrix

**`@gym/api-client`**

- **Owns:** OpenAPI-generated types, `openapi-fetch`, browser-cookie and native-bearer adapters, HTTP failure classification.
- **Declared consumers:** `web`, `trainer`, `admin`, `mobile`.
- **Runtime boundary:** Standard Fetch only; no Prisma, secrets, token persistence or automatic write retry. Next SSR cookie forwarding is app-local.

**`@gym/domain`**

- **Owns:** Pure workout status and transition preconditions, plus set-progress calculations.
- **Declared consumers:** `api`, `web`, `mobile` (API adoption via #329).
- **Runtime boundary:** No framework dependencies; API owns authorization and writes. Keep this limited cross-runtime contract small; native ESM and TypeScript declarations support the Node runtime and Mobile.

**`@gym/datetime`**

- **Owns:** technical timestamp parsing, IANA timezone validation, civil calendar arithmetic and time projections.
- **Declared consumers:** `api`, `web`, `trainer`, `mobile`, `@gym/domain`.
- **Runtime boundary:** platform-neutral ESM JS/declarations; technical leaf with date-fns and @date-fns/tz only as date library family. Native named-zone acceptance remains pending.

**`@gym/i18n`**

- **Owns:** Ukrainian/English ICU catalogs, typed keys, locale negotiation and lazy loading.
- **Declared consumers:** `web`, `trainer`, `admin`, `landing`, `mobile`.
- **Runtime boundary:** Framework-neutral messages; Next uses `next-intl`, Expo uses `react-intl` through app adapters. API error codes remain locale-neutral.

**`@gym/design-tokens`**

- **Owns:** Semantic palette, Web CSS and native color adapters.
- **Declared consumers:** `web`, `trainer`, `admin`, `landing`, `mobile`.
- **Runtime boundary:** CSS is Web-only; `./native` and `./ovranto-native` target native. Never import both legacy and OVRANTO root stylesheets together.

**`@gym/ui-web`**

- **Owns:** React Web primitives: Button, Input, Card, BrandLogo and AsyncFeedback.
- **Declared consumers:** `web`, `trainer`, `admin`, `landing`.
- **Runtime boundary:** Browser/Next only; **forbidden in Expo**. No business forms, routing or network hooks.

The API declares `@gym/domain` and `@gym/datetime` as direct shared runtime dependencies. `scripts/ci-select.mjs` conservatively includes API checks for i18n catalog edits because of transactional email concerns; **CI selection is not equivalent to a package import**.

### Public export registry and declared workspace graph

| Package       | Public exports                                                | Declared consumers                   |
| ------------- | ------------------------------------------------------------- | ------------------------------------ |
| api-client    | `.`                                                           | Web, Trainer, Admin, Mobile          |
| domain        | `.`                                                           | API, Web, Mobile                     |
| datetime      | `.`                                                           | API, Web, Trainer, Mobile, domain    |
| i18n          | `.`, `./async`, `./locales`, `./request-locale`               | Web, Trainer, Admin, Landing, Mobile |
| design-tokens | `./dark.css`, `./native`, `./ovranto.css`, `./ovranto-native` | Web, Trainer, Admin, Landing, Mobile |
| ui-web        | `.`, `./utils`                                                | Web, Trainer, Admin, Landing         |

The only declared intra-package runtime edge is domain -> datetime. No app-to-app edge or package cycle appears in these manifests. This is not a complete source import graph. CSS exports target Web and native token exports target Mobile; no shared Web UI in Expo. See package manifests for exact conditions and package scripts for current test/build commands.

## Import and ownership rules

1. **No app → app dependencies.** No package.json dependency on another app and no direct `@gym/<app>` or relative cross-app source import. Reuse shared package APIs instead.
2. **No package → app dependencies.** Packages depend only on their own code, stable external dependencies and, where necessary, other public shared package exports.
3. **No shared-package cycles.** Keep package dependency graph acyclic. Prefer explicit named/subpath exports; avoid deep imports into another package's `src`.
4. **Platform-neutral first, platform-specific at the edge.** `domain`, `i18n` and API transport should not import React, Nest or device storage; web UI may depend on React but never React Native.
5. **Security belongs to API.** Shared workout rules are UX preconditions; they never authorize writes, override transaction locks or bypass tenancy.
6. **Avoid new global state systems or automatic HTTP write retries.** TanStack Query can be used in consuming apps, with idempotency/reconciliation decisions scoped to each operation.
7. **Coordinate shared changes.** A contract, token or catalog change requires testing every declared consumer and the affected CI matrix. Update generated OpenAPI types in the same API contract PR.

## Governance and lifecycle (SP01–SP10)

- App-local first; two real consumers or a justified tested abstraction. Proposal with ownership, alternatives, exports, runtime, dependency edge, migration and tests requires separate owner approval.
- Private atomic workspace, explicit exports, correct runtime/dev/peer dependencies and workspace:*; independent deployed app/API compatibility remains separate. Hybrid source-first, generated and JS/declarations models retained pending scoped build evaluations.
- No generic utils/common/types/contracts package or new validation/units/native UI package without evidence and approval. Backend Core remains undecided until ABI08 and explicit owner review; no implied CoreModule or final modules/ decision.
- dependency-cruiser is the primary graph tool; Knip findings require review. Preserve existing checks until equivalent negative fixtures and resolver coverage are proven. Extend to aliases, relative, type-only, static dynamic imports and all relevant roots; computed imports require review. Report-only before verified blocking rules; ratchet noncritical legacy debt with scoped owner/reason/issue/review-deadline exceptions, never security bypass.
- Stable public contracts, documented deprecations/replacements and affected consumer migration before removal; package DoD and CI per Shared Packages Strategy. Actual hooks and manual merge required.

## Verification and limits

Run:

```sh
node scripts/check-workspace-boundaries.mjs
pnpm test:tooling
pnpm --filter @gym/api-client test
pnpm --filter @gym/design-tokens test
pnpm --filter @gym/i18n test
```

The existing workspace guard covers direct dependencies in all workspace manifests, cycles among shared packages, and _literal_ source imports under `apps/*/src` and `packages/*/src` that reach another app or import an app package. It does **not** resolve arbitrary computed imports, every alias or imports from `scripts/`; code review and existing API AST guards remain necessary. Keep any future extension deliberate rather than claiming a complete import graph.

Unit fixtures exercise valid imports, app-to-app manifest imports, app-to-app source imports, package-to-app source imports and package cycles. GitHub CI provides the repository-wide verification; this ADR is not evidence of device-level tests or production readiness.

## Follow-up ownership

- [#371](https://github.com/sauron9521/gym-platform/issues/371): adopt shared runtime API adapters without an alternate fetch client.
- [#372](https://github.com/sauron9521/gym-platform/issues/372): Trainer adoption of existing i18n/tokens/ui-web, including Light/Dark and a11y.
- [#374](https://github.com/sauron9521/gym-platform/issues/374): refine affected-workspace CI coverage and measure impact.
- [#360](https://github.com/sauron9521/gym-platform/issues/360): tighten Nest feature-to-feature imports using explicit facades, separately from workspace rules.
- [#373](https://github.com/sauron9521/gym-platform/issues/373): Trainer Mobile remains a design-only decision; no second native UI package yet.

The owner has accepted the strategic direction. Do not close #370 until actual consumer/deep-import reconciliation, runtime tests, CI evidence and separate owner implementation acceptance. Merge is manual.

## Datetime foundation extension — 2026-11-27

Owner approved the introduction of a focused sixth shared package
`@gym/datetime` for date-fns and @date-fns/tz adoption before #342.
It owns strict absolute timestamp parsing, named timezone validation
and civil calendar date operations. `@gym/domain` depends on its public
entrypoint and retains business status rules. No app imports, circular
dependencies, framework dependencies or new generic utils package.

API, Web and Mobile already consume domain. The API image context
explicitly permits only the new package's runtime and declarations;
production deploy smoke and full workspace CI cover this dependency.
The initial migration preserves existing device-local calendar semantics.
Named-zone use on physical Hermes devices is not yet accepted; do not
enable native reminders or install global Intl polyfills speculatively.

DT02–DT04 move calendar arithmetic, API timezone/quiet-hour projection
and analytics windows to the same package. DT05 enforces date library
ownership in existing manifest and Dependency Cruiser checks. The technical
package is a leaf; no direct competing library imports or dependencies.
Native capability verification and reminder scheduling remain separate gates.
Keep session TTL, monotonic deadlines and SQL retention time sources
unchanged. See [datetime adoption inventory](datetime-adoption.md).
