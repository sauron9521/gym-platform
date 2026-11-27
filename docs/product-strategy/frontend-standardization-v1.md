# OVRANTO — Frontend Standardization Strategy v1.0

**Decision: OWNER APPROVED, 2026-11-27 (F01–F10).** Publication and implementation evidence are tracked separately in [Architecture Roadmap #380](https://github.com/sauron9521/gym-platform/issues/380) and [Strategic Roadmap #588](https://github.com/sauron9521/gym-platform/issues/588).

This cross-cutting strategy covers Athlete Web, Trainer Web, Admin, Landing and Athlete Mobile. It complements [Release & Feature Management](release-feature-management-v1.md), [S02 Customer Experience](s02-customer-experience-v1.md), [S03 Privacy](s03-privacy-data-ownership-v1.md), [S05 Security](s05-security-trust-v1.md), [S06 Reliability](s06-production-reliability-v1.md) and [S07 Analytics](s07-product-analytics-experiments-v1.md). Existing [Master Roadmap #353](https://github.com/sauron9521/gym-platform/issues/353), architecture ADRs and implementation owners remain authoritative for delivery. Approval of the direction is not evidence of implementation, dependency installation, native acceptance, deployment, paid launch or Beta GO.

## F01 — Architecture & File Structure

Use Pragmatic Feature-Sliced Design across all client apps. Optional downward layers: app (routing/providers/layouts), views (Next) or screens (Expo), widgets, features, entities, shared. Simple routes may compose directly; create layers and segments only when justified. Keep Next App Router and Expo Router conventions. Feature slices may contain ui/model/api/lib/config and explicit public entrypoints; keep business UI, query options and forms feature-local. No uncontrolled cross-slice, upward, app-to-app or package-to-app imports; no cycles. Separate server/client/native entrypoints and avoid barrel-induced cycles or unnecessary client bundles.

Extend the existing [FSD shared import rules](../development/frontend-fsd-boundaries.md) and [ADR-006](../architecture/adr-006-shared-package-boundaries.md), not a second scanner. The current shared alias guard is partial, not full graph enforcement. Inventory aliases, relative imports, cycles and runtime boundaries; evaluate Steiger and dependency-cruiser against actual structure and current ESLint/Knip/workspace guards. Report-only baseline, positive/negative fixtures, bounded pilot, then ratchet new violations with documented temporary exceptions. No mass moves, mandatory empty layers or unapproved tool installation.

## F02 — Server & Client Components

Next.js is Server-first, Client when needed; minimize use client boundaries. Static Landing where feasible with locale/SEO parity. Client components handle interactions, hooks and browser APIs and may still be server pre-rendered. Mobile remains native/client-rendered with existing offline behavior. NestJS is the sole authoritative business/permission/write boundary; Route Handlers and Server Actions only justified thin adapters with existing session, authorization, validation and CSRF semantics. No Next direct database access.

Keep server-only and client-only modules separate. Use request-scoped authenticated API adapters and selective SSR prefetch, dehydration and TanStack Query HydrationBoundary when justified. Isolate server QueryClient per request; align keys, avoid duplicate ownership/fetching and serialize only authorized necessary data. No shared private Next/CDN cache or secrets in hydration. Clear applicable private query state on logout/account switch. Use route-level loading, Suspense and streaming where useful; do not force SSR or CSR everywhere. Audit routes and measure before optimizing; test isolation, hydration and failure recovery.

## F03 — State Management

One owner per state type:

- Server records and mutation results: TanStack Query or existing authorized server reads.
- Local interaction: React state/reducer; forms: React Hook Form and Zod.
- Shareable Web URL state: router/nuqs; low-frequency context and providers: React Context.
- Justified shared transient client state: feature-scoped Zustand with narrow selectors, deterministic initialization and explicit account/workout/program/version scope.
- Durable offline drafts, credentials and device preferences: existing dedicated repositories/auth/settings lifecycle.

Retain [ADR-009](../architecture/adr-009-client-state-management.md) and Mobile timer/settings stores and active-workout continuation. Automated pilot evidence exists; physical Android/iOS acceptance and global performance gains are not established. Rest timer remains ephemeral with absolute deadline, starts only after authoritative set success, resets on relevant account/workout/terminal transitions; no new background alarm or disk persistence. Preserve settings write acknowledgement, safe defaults and stale callback protection. No root mega-store, Redux/Jotai/MobX, duplicate server/form/offline state, credential persistence, shared server singleton or blanket Zustand rollout. Clear account-scoped state safely; do not blindly discard unsynced drafts. Trainer editor store deferred until real independent panel needs justify it versus lifted state/reducer, then separate bounded pilot; retain explicit Save Draft and server-authoritative program records.

## F04 — API, Caching & Synchronization

Use existing typed OpenAPI-generated @gym/api-client, browser cookie/native bearer/request-scoped server adapters, feature-owned Query Key Factories and standard query options. Include normalized filters, pagination, locale/API/audience scope where relevant; isolate private caches and cancel/ignore obsolete reads across account changes. No whole private query-cache persistence. Define data-specific freshness, gcTime, focus/reconnect and polling independently. Candidate staleTime values (catalog 15m, profile 5m, programs/history/progress 2m, inbox 30s, active workout/critical Admin 0) are hypotheses only; measure before configuring. Target affected detail/list/aggregate invalidation, not global refetch storms.

Optimistic updates only for reversible low-risk actions with safe reconciliation; critical set/workout completion, publish/assign, role and billing actions require authoritative confirmation. Preserve encrypted offline draft storage and existing revision/idempotency/conflict policy. Local saved, pending, uncertain, conflict and server-confirmed are distinct. On ambiguous write response read canonical state first; retry only with a proven idempotency contract and same operation identity, never blind PATCH replay. No silent discard or duplicate results. Preserve #322/#324/#325 native/device gates.

Reuse API error classification: bounded transient read retries with backoff/jitter and Retry-After, coordinated bounded session refresh, no blind validation/authorization/conflict retries; actual validation status/code remains contract-specific. REST primary, visibility-aware polling first. SSE #580 remains deferred until measured need and separate implementation GO; authenticated lightweight invalidation signals, authorized GET reconciliation, reconnect and replica safety. WebSocket deferred; mobile push is not authoritative data. Preserve API versioning and compatibility policy.

## F05 — Forms & Validation

React Hook Form + Zod for complex forms; simple forms can use smaller existing mechanisms. Feature-local model/UI/schema/API as needed, no mandatory boilerplate. NestJS mandatory authoritative validation, permissions, uniqueness, business invariants and database integrity; client validation is UX only. Preserve generated OpenAPI contract types. Evaluate @gym/validation only after actual shared stable schema inventory and ADR-006 review; no package creation or duplicated contract by default.

Reuse accessible Web/native form primitives: label, description, error linkage, focus/keyboard, disabled/pending states, Light/Dark and uk/en. Preserve approved blur/submit validation, localized @gym/i18n codes and known safe field mappings; generic fallback, no account enumeration or raw errors. Synchronous submit guard plus mutation lifecycle, preserve inputs on recoverable failure, reset baseline only after confirmed success. Dirty state/leave guard for critical forms, with platform limitations documented. Trainer explicit Save Draft, leave guard and Preview → Publish → Assign; no silent primary autosave. Selective autosave only with bounded/coalesced safe writes, revision/conflict handling, pending/error visibility; never credentials or critical admin/billing transitions. Workout drafts remain dedicated offline storage. Test schema edge cases, server rejection, field mapping, repeated/ambiguous submit, dirty navigation, account switching and accessible recovery.

## F06 — Design System & Shared UI

Retain [Design System v2 #383](https://github.com/sauron9521/gym-platform/issues/383), Premium Athletic Minimal, Deep Teal/Terracotta, Manrope, 12–16px radius, restrained borders/shadows, contextual density, Lucide and functional motion. Existing @gym/design-tokens is the single semantic source; Web CSS/native adapters with parity checks, actual repository values not illustrative palette samples. Full Light/Dark/System, system default plus override, hydration-safe persistence and native OS changes. No uncontrolled hardcoded colors or new visual redesign.

Extend existing @gym/ui-web primitives for demonstrated reuse using Radix/shadcn-style code ownership, Tailwind and CVA; separate runtime entrypoints. Feature-specific business components/navigation stay in owning app. Native stays app-local shared/ui with Gluestack and Uniwind; never import ui-web into Expo. Defer @gym/ui-native until justified real reuse or independent boundary and separate approval, no speculative Trainer Mobile.

Evaluate and pilot Web Storybook against actual dependency versions, existing previews and CI cost; representative isolated components, synthetic fixtures, both themes/locales, responsive, error/loading/disabled and accessibility states. Native Storybook deferred; no mandatory public catalog or paid service. Visual regression and reviewed baselines under #389; WCAG 2.2 AA target for Web and native accessibility requirements, keyboard/screen-reader/Dynamic Type/reduced motion; automated checks alone are not conformance proof. Incremental parity-tested migration, no duplicate framework.

## F07 — Data Tables, Filters & Search

Use TanStack Table for complex Web tables, nuqs for safe URL filter/sort/pagination state, TanStack Query and typed client; server-owned bounded search/filter/sort for large/protected datasets. Offset or cursor based on use case; stable deterministic order and tie-breaker, validated opaque cursor/filter scope, allowlisted fields, capped page size. Small bounded local lists may filter locally. Debounce free-text as useful, cancel obsolete reads, ignore stale results, reset page on filter changes, preserve deep links/history; no sensitive values or tokens in URL/telemetry. No blanket API contract changes or new search engine.

Share reusable presentation primitives via ui-web only after demonstrated reuse; columns, actions, permissions and queries stay feature-local. Responsive accessible sorting, selection, keyboard/focus and both themes/locales. Later preferences/Saved Views (P2), account-scoped validated versioned settings, no authorization bypass or sensitive persisted search. Bulk actions explicitly scope selected page/all matching, reauthorize each target, bound batches, confirmation/reason/step-up MFA where required, partial outcome reconciliation and audit. CSV export authorized fields/rows, purpose/size limits, formula-injection mitigation and audit of sensitive exports; preserve S03. These later capabilities must not block Beta. TanStack Virtual only after profiling/accessibility evidence and separate dependency decision.

Preserve Library-first #711 LF04 Admin table pilot (Admin Users candidate after inventory) → LF05 nuqs on same screen → LF06 Trainer/other proven consumers. No premature global component or migration.

## F08 — Error Handling & Loading States

Extend existing @gym/api-client classifyHttpFailure/parseRetryAfterSeconds/auth classification and AsyncFeedback, not a parallel error system. Localize stable safe error codes through @gym/i18n and context-specific recovery, preserve F04/F05 retry/field error policy. No new mandatory envelope or raw stack/PII in UI. Layered Next error.tsx/global-error.tsx/loading.tsx/not-found.tsx and justified widget boundaries; Expo Router/React native boundaries. Handle event/async/query/mutation failures explicitly; render boundaries do not catch everything. Recovery must not lose unsaved forms/workouts or replay unsafe writes.

Standardize Skeleton for initial load, Spinner for discrete action, measurable Progress, truthful Empty State after successful empty response, AsyncFeedback, offline banner and sync status. Keep authorized cached content during background refreshing; mark stale/offline/error appropriately, never show forbidden/old-account data. Inline feedback primary, toast supplemental, accessible nonduplicative status announcements and focus; server-confirmed success only after authoritative result. Preserve device-local/pending/uncertain/conflict distinctions.

Correlate safe opaque request ID, app/release/environment and bounded error categories with existing #316/#350/#1002. Support reference only if available; no secrets, request bodies, identity/workout data, sensitive URLs or raw traces; avoid alert/toast storms. Sentry remains subject to existing build/environment/privacy gates. Test failed reads, session/permission/conflict/429, offline/ambiguous writes, accessible recovery and account changes.

## F09 — Frontend Performance

Measure First, Optimize Second. Web field targets at p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, mobile/desktop separately with representative samples. Goals, not achieved measurements or unconditional gates. Distinguish lab/field, cold/warm, route/device/network/build and sample size; lab TBT is not field INP. Establish reproducible production-mode baselines for Landing and key Athlete/Trainer/Admin routes, compare equivalent builds/releases and correlate API performance without duplicate backend benchmarks.

Analyze bundle size by app/route, initial JS/CSS/assets, network/TTFB, interactions and memory. Prefer built-in Next analyzer, server-first, selective code splitting/lazy loading, responsive dimensioned images, font optimization with Ukrainian glyphs and privacy-safe cache; never delay critical workout UI for speculative savings. Profile React, use memo/transition/selectors when justified; evaluate React Compiler separately for Next and Expo before integration.

Mobile: physical representative Android/iOS release-mode builds, cold/warm start, frames/interaction latency, memory, artifact size, logging and navigation/offline/resume. Existing FlatList/SectionList/Reanimated/SQLite first; FlashList and Expo Image candidates only after evidence and parity checks. Expo Go/dev-only metrics not release proof. Preserve native safety gates.

Operations Center #1002: read-only aggregate client performance by app/release/platform and bounded route template, source/sample/window/denominator and UNKNOWN when missing/stale/sparse, privacy/consent/redaction, no user identifiers or raw workout details, no duplicate collector. Compare releases. Start report-only bundle/asset budgets and bounded Lighthouse CI pilot, review variance and CI costs, agree thresholds/exceptions before enforcement; no arbitrary numeric bundle/startup budgets. Existing mandatory release/security checks stay intact.

## F10 — Testing & Architecture Enforcement

Risk-based tests over arbitrary 100% coverage; do not weaken existing thresholds. P0 critical authentication/MFA, permissions, workout writes, offline recovery, billing when applicable; P1 editor/cache/forms/shared UI. Vitest/Testing Library unit/component/integration, Playwright Web E2E, Maestro native E2E, existing visual/axe/manual accessibility checks; colocate new unit/component tests where compatible, keep existing integration/contract/E2E layout and runners. Approved oasdiff and fast-check follow #711 LF02/LF03, no replacement runner. Critical Android/iOS device evidence remains distinct from JS/CI/emulator-only evidence.

Reuse ESLint/TypeScript/Knip/workspace checks; #1006 resolver-aware FSD/package/cycle/runtime guards and staged enforcement. Preserve API contract/generated client drift and reviewed version compatibility. Turborepo/GitHub Actions affected CI includes transitive consumers and conservative fallback for unknown/global/lockfile changes. Keep full exact-SHA release evidence and mandatory API/security/native gates. Deterministic fixtures, isolated accounts, controlled clock/network and explicit flaky-test investigation; rerun is diagnostic, not a fix. No silent skips or weakened checks.

Frontend PR Definition of Done:

- Applicable architecture, type/lint and risk-based test checks pass; no new unreviewed dependency or regression.
- Relevant responsive, Light/Dark, uk/en, visual and accessibility checks; loading/error/empty/offline states truthful where applicable.
- Security, authorization, privacy, cache isolation and mutation safety preserved; contracts/docs updated as needed.
- Relevant CI green and reviewed, manual owner merge only; device/release signoff separate.

## Delivery coordination and open decisions

Reconcile current main/open PRs before each bounded PR. Existing P0/security/legal/native/reliability/Beta gates take precedence; no new deadline or blanket migration. This is a planning sequence, not a new epic or reordering of approved backlogs.

- F01/F02: #1006 architecture inventory/guard pilot; #370 package boundaries; inventory SSR/auth routes before bounded hydration pilot.
- F03–F05: #325/#324/#322 Mobile timer/reconciliation/offline; #365 Trainer editor; #287/#319/#370 API/shared ownership; evaluate shared validation only after real duplication evidence.
- F06–F08: #383/#391/#372 design rollout, #389 QA, #387 Admin pilot; #711 LF04–06 unchanged, #563/#580 polling-first; #316/#350/#1002 safe diagnostics.
- F09–F10: #313 API baseline, #335/#374 affected CI, #389 visual/accessibility, #349 native QA, #1002 Operations Center; inventory/report-only performance and architecture gates, then reviewed enforcement.

Open decisions: exact cache/polling/debounce/page-size parameters; tool choice for resolver-aware guards, Web Storybook configuration, shared validation/native package justification, future virtualized lists/compiler/image candidates, SSR pilot routes, performance budgets/telemetry provider and sample criteria. These require evidence and applicable separate approval. Existing device, security, data recovery, release and Beta gates remain open until proved; no source/dependency/infrastructure changes follow automatically from this document.

## Owner decision traceability

All ten blocks were approved on 2026-11-27. The following GitHub records retain the detailed decisions and implementation links:

- [F01](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7227623131)
- [F02](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7227732387)
- [F03](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7227845781)
- [F04](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7227995353)
- [F05](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228057297)
- [F06](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228152421)
- [F07](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228219343)
- [F08](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228334320)
- [F09](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228462121)
- [F10](https://github.com/sauron9521/gym-platform/issues/380#issuecomment-7228556391)
