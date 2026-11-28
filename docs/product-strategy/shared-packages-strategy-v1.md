# OVRANTO — Shared Packages Strategy v1.0

- **Decision:** OWNER APPROVED, SP01–SP10 (120 decisions), 2026-11-27–28.
- **Publication:** manual owner merge and main verification required.
- **Scope:** private pnpm/Turborepo monorepo; shared runtime packages and developer tooling.
- **Related:** [ADR-006](../architecture/adr-006-shared-package-boundaries.md), [Frontend Standardization](frontend-standardization-v1.md), [Release & Feature Management](release-feature-management-v1.md), [#380](https://github.com/sauron9521/gym-platform/issues/380), [#588](https://github.com/sauron9521/gym-platform/issues/588), [#353](https://github.com/sauron9521/gym-platform/issues/353).
- **Limit:** policy approval, not implementation acceptance, new package/dependency approval, Beta/security/production GO or final Backend Core decision.

## SP01 — Package Architecture & Ownership

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228738249).

Retain the modular pnpm/Turborepo monorepo, six independently deployed apps and six existing runtime packages. Each package has explicit ownership. App-local first: promote stable behavior only with two real consumers or a narrow justified, tested abstraction and separate owner approval. Distinguish platform-neutral from platform-specific packages. Use explicit package exports; no app-to-app, package-to-app or cyclic package dependencies. NestJS remains authoritative for business operations, authorization, persistence and transactions. Avoid generic utils/common/types/contracts dumping grounds. Migrate incrementally and keep ADR-006 current.

The package registry in ADR-006 records declared consumers, exports, runtime boundaries and ownership, not proof of actual usage. Reconcile actual imports before extraction. No @gym/core decision, including CoreModule or final modules/ layout, until ABI08 and explicit owner review (#909, ADR-007/010). No new package approved merely by this strategy.

## SP02 — Domain Package & Business Logic

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228837456).

Retain @gym/domain for pure shared rules and separate it from server-owned domain/application logic. NestJS owns authoritative business operations and rechecks invariants on transaction state. Shared rules are deterministic, with explicit inputs, no I/O or global state; no NestJS, Prisma, React, transport DTOs or stores. Technical date operations use datetime. Organize by subject area and explicit subpath exports only as needed, preserving existing contracts. Evaluate TypeScript source with generated JS/declarations via a bounded tsc pilot (Node ESM, Next, Metro/Hermes, Docker and build graph parity); no migration authorized. Extract shared calculations only with actual reuse/invariant evidence. Unit and property-based tests with fast-check follow LF03 (#711); reproducible seeds and edge cases, parity with server invariants and transaction tests, not a substitute for security or native tests. Backend Core remains undecided until ABI08.

## SP03 — API Client & Contracts

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7234760855).

Retain @gym/api-client as the single typed HTTP transport; OpenAPI is canonical transport contract generated from NestJS. Retain openapi-typescript/openapi-fetch and generate types in the same contract PR, no manually duplicated DTO/interface or edited generated declarations. Separate browser cookie, SSR request-scoped forwarding and native bearer adapters; caller owns secure storage and refresh, enforce origin/redirect, CSRF/CORS and session boundaries. No global authenticated singleton, shared private cache, blind write retry, React, Zustand or business logic in transport. Evaluate openapi-react-query only on a noncritical read-only pilot outside the package, with cancellation, cache/account isolation, errors, bundle/CI cost and compatibility evidence. Query keys/options/mutations remain feature-local. Support current/previous API major as required by release policy (#1000); URI /v1 after ABI08 before public Beta, neutral ops routes, explicit major exports only when needed. oasdiff LF02 checks breaking changes with reviewed baseline; selective runtime validation for critical responses/boundaries, no blanket second schema system. Contract tests, drift checks, negative behavior/security tests and all affected consumers required.

## SP04 — Validation & Shared Schemas

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7234788942).

Zod is the runtime validation standard; NestJS authoritative validation is mandatory. Transport DTO/API schemas remain API-owned; client form schemas feature-local and UX-only. Separate validation, pure domain rules, server authorization and DB constraints. Do not create @gym/validation before actual duplication/ownership audit and separate approval of extraction. Narrow reused stable platform-neutral schemas only; no Nest/Prisma/React or second transport truth. Explicit input/output/transform/coercion semantics (z.input/z.output where useful); no manual OpenAPI contract duplication. Selective critical response checks per SP03; stable safe error codes and client localization through i18n. Test valid/invalid/edge input, normalization, error mapping, schema/contract compatibility and affected CI; preserve offline drafts and conflicts.

## SP05 — DateTime & Technical Utilities

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7234896140).

Retain @gym/datetime as a technical leaf and date-fns/@date-fns/tz as the approved library family. UTC for absolute timestamps (strict offset-bearing input), IANA zones for named civil calculations; distinguish instant, civil date, local time and duration. Explicit calendar vs elapsed operations, range inclusivity and DST gap/fold policy; never silently infer invalid zones. Preserve Date/Intl/SQL where semantically appropriate; Intl for localized formatting. Keep session TTL, monotonic deadlines, SQL retention, UTC analytics buckets and authoritative scheduling semantics distinct. Native named-zone/DST support requires physical evidence before reminders or polyfills. For new measurement contracts use explicit canonical kg, cm, m, seconds, kcal and kg × reps where meaningful; minutes for reminder offsets, ms for technical timeouts. Convert at input/display boundaries, audit precision/rounding/current contracts before migration, never rewrite historical data for display preference. Defer @gym/units; no generic @gym/utils. Selectively inject now/clock for deterministic tests, not a global Clock service. DST/leap/boundary/non-hour-zone/invalid/elapsed/conversion/cross-runtime tests; incremental migration, no cosmetic replacement. See [datetime adoption](../architecture/datetime-adoption.md).

## SP06 — Internationalization & Localization

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7234945746).

Retain framework-neutral @gym/i18n as canonical UI catalog, next-intl on Web, react-intl on Mobile, uk/en required for Beta. Incremental domain-organized catalogs only when justified, typed keys and ICU MessageFormat, selective loading and bundle checks. Preserve existing entrypoints and catalog parity; supported explicit preference before supported Accept-Language then uk fallback, account isolation and hydration/persistence. Independent language/timezone/region/measurement settings; currency/actual billing and canonical data unaffected by locale. Intl plural/number/date/unit formatting, named zones per SP05. Language-neutral stable safe API error codes and client localization, unknown-code fallback; never parse localized server text. Separate database system-exercise translations, localized server templates and versioned legal text from UI catalogs; preserve original user/trainer content, no automated translation. Landing localized routes/metadata/canonical/hreflang/sitemap; defer TMS and additional locales pending demand and approval. Automated key/ICU argument/fallback/persistence checks, UK/EN visual/accessibility/text overflow and physical device QA.

## SP07 — Shared UI & Design Tokens

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235133472).

Retain @gym/design-tokens and @gym/ui-web. One canonical palette-source.json and generator for CSS/native outputs, retain compatible exports; incremental primitive/semantic/component tokens, no parallel hardcoded palette. Style Dictionary evaluation only if measured complexity justifies migration and output parity. Separate Web (Radix/shadcn-style/Tailwind/CVA) and Native (Gluestack/UniWind) components, defer @gym/ui-native, no universal UI library or new icons/theme/brand/core package. Expand ui-web only with evidence of reuse; business forms/widgets, network queries and global state remain features, local presentational state allowed. Explicit exports; evaluate server-safe vs client-only entrypoints without breaking current imports. Preserve Design System v2, Light/Dark/System, athlete vs trainer/admin density, reduced motion, UK/EN and semantic accessibility. Generated native themes do not prove runtime switching. Bounded Storybook evaluation/pilot per F06; no hosted service or dependency rollout approved. Visual regression and accessibility tests plus manual keyboard/screen-reader/device evidence. CI verifies generated output, parity, contracts and affected consumers.

## SP08 — Shared Configuration & Developer Tooling

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235220023).

Keep tooling/ central, root formatter and existing helpers, shared TS presets with local paths/include/runtime settings, one Next ESLint preset and distinct Expo/Oxlint settings, shared Prettier/Vitest/compatible test configuration. Avoid cosmetic moves or new configuration packages. pnpm Catalogs follow LF01, preserve resolved versions/frozen lockfile and separate Expo-compatible groups. Turborepo orchestrates tasks and affected graph; cache deterministic tasks only after input/env/output reproducibility evidence, no unsafe integration/E2E/security caching. Evaluate Turborepo and NestJS generators (#924); finalize API templates after ABI08. Extend Knip/dependency-cruiser; replace custom scripts only after negative fixtures, resolver coverage and functional CI parity. Controlled Dependabot, license/security/runtime/peer/install-script review and affected consumers. Actual Husky pre-commit/pre-push in isolated worktrees, no bypass or API-commit workaround; report blockers. One PR per task, exact green SHA, owner review and manual merge.

## SP09 — Package Lifecycle & Dependency Management

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235430691).

Atomic monorepo changes for private internal packages, no npm publication; defer Changesets until external/independent release need. Independent immutable application artifacts and deployed API/mobile compatibility remain separate from source atomicity. Hybrid source-first (i18n/ui-web), generated (design-tokens/OpenAPI types) and JS/declarations (domain/datetime); evaluate tsc generation for the latter only through a bounded pilot, no forced dist or bundler. Retain workspace:* and LF01 catalogs, declare runtime/dev/peer dependencies correctly, preserve React singleton compatibility/CSS side effects and avoid hoisted undeclared dependencies. Minimal acyclic graph; domain -> datetime is the current declared shared-package edge, no speculative edges. Public API lifecycle experimental/stable/deprecated/migrated/removed: document replacement, verify consumers and deployed/persisted compatibility, use staged compatible exports for larger migrations. Package DoD below and affected-consumer CI. Controlled Dependabot groups, runtime minor/major review, security priority, documented compatibility-guard review triggers.

## SP10 — Package Governance & Architecture Enforcement

[Owner decision](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7235521401).

One governance process: demonstrate need, propose ownership/consumers/runtime/alternatives/exports/dependencies/migration/tests, separate owner approval, bounded implementation, verification and manual merge. Apply to new dependency edges as well. ADR-006, manifests and README form the registry; no new registry service. dependency-cruiser is primary graph tool, Knip for unused exports/dependencies (review findings before removal), ESLint/Oxlint local rules, TypeScript contracts, pnpm manifests and Turbo task graph. Keep custom guards until parity. Enforce public exports/no deep imports, platform-neutral/Web/native/server boundaries, no app edges, cycles or undeclared dependencies. Extend resolver-aware coverage across aliases, relative, type-only and statically resolvable dynamic imports and supported roots; computed imports require separate review. Report-only baseline/pilot first; verified rules ratchet against new violations, reviewed historical noncritical debt only. Exceptions scoped with reason, owner, issue and review deadline; no security bypass. Positive/negative fixtures, affected consumer CI and incremental PRs coordinated with existing issues.

## Package Definition of Done

- Document owner/responsibility, real consumers, runtime, explicit public exports, dependency rationale, usage and migration/replacement.
- Typecheck and test applicable contracts, pure behavior, generated drift, runtime/build/resolution and negative boundary fixtures.
- No unauthorized dependency edge, cycle, private import, platform leak or server-authority regression.
- Verify affected direct and transitive consumers; conservative fallback on unknown/global/lockfile changes, existing release/security/native gates unchanged.
- Reproducible build where applicable, normal hooks, exact green CI and manual owner merge.

## Delivery sequence and existing ownership

This is a proposed sequencing within the package workstream, not permission to start implementation or reprioritize P0/security/Beta work. Re-pin main, reconcile source-level evidence and open PRs before each task; no duplicate issues or premature closures.

| Stage  | Scope                                           | Existing coordination  |
| ------ | ----------------------------------------------- | ---------------------- |
| SP-R01 | Strategy and ADR publication                    | #380, #588, #370       |
| SP-R02 | Actual consumers, exports and runtime inventory | #370, #319, #329       |
| SP-R03 | Catalogs per LF01                               | #711                   |
| SP-R04 | Resolver-aware package boundaries               | #370, #1006            |
| SP-R05 | Cross-runtime and affected CI evidence          | #374, #335, #349, #371 |
| SP-R06 | Shared config and tooling parity                | #711, #924             |
| SP-R07 | Domain/datetime build evaluation                | #370, #329             |
| SP-R08 | Zod duplication audit                           | #370, #287, #391       |
| SP-R09 | Incremental i18n/UI adoption                    | #319, #372, #389, #391 |
| SP-R10 | Verified enforcement ratchet                    | #370, #1006, #335      |

LF01–08 ordering in #711 remains authoritative for approved library adoption. oasdiff and fast-check follow LF02/LF03, not this publication. openapi-react-query, Style Dictionary, Storybook, generator and tsc evaluations remain bounded candidates; validation/units/ui-native/analytics/feature-flags/testing/charts-web packages need separately approved evidence. No generic utils/common/types/contracts or universal UI package. No decision on Backend Core before #909 ABI08. Existing S04/S05/S06 and Beta gates remain independent. Record exact merged SHA and CI in #588 after owner merge; #370 stays open until implementation evidence and owner review.
