# ADR-005 — Product ownership and Trainer Web route migration

- **Status:** Accepted target architecture; migration NOT yet implemented
- **Scope:** M05 / E14 / Issue [#359](https://github.com/sauron9521/gym-platform/issues/359)
- **Decision date:** 2026-11-19
- **Source of truth:** [master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353), [product boundary roadmap #380](https://github.com/sauron9521/gym-platform/issues/380), [E14 #354](https://github.com/sauron9521/gym-platform/issues/354), [E15 #355](https://github.com/sauron9521/gym-platform/issues/355)
- **Implementation owner (DRI):** each owning product app; cross-product authorization and resource ownership are enforced by `apps/api`

## Context and decision

The monorepo already has a single NestJS API, shared identity, Athlete Web, Athlete Mobile, Admin, and Landing. Trainer pages currently live in Athlete Web; Expo also exposes a trainer-athletes route. Moving these routes before the separate Trainer app, capability model and authentication are ready risks breaking active sessions, old links, and trainer/athlete dual use.

**Decision:** keep one NestJS modular monolith (`apps/api`), one `User` identity, one PostgreSQL/Prisma data model and distinct frontend products:

- **Athlete Web** — owner: `apps/web`; responsibility: Athlete dashboard, workouts, exercise library, athlete programs, personal profile and sign-in.
- **Athlete Mobile** — owner: `apps/mobile`; responsibility: Native athlete sessions, history, programs, profile and progress; trainer-only legacy screen is an audit/cutover item.
- **Trainer Web** — owner: **future** `apps/trainer`; responsibility: Trainer clients, programs, templates, builder, assignments, feedback and trainer dashboard.
- **Admin Web** — owner: `apps/admin`; responsibility: Privileged admin review, roles, audit and operations.
- **Marketing** — owner: `apps/landing`; responsibility: Public OVRANTO product pages and links; no authenticated data.
- **Backend** — owner: `apps/api`; responsibility: Auth, ownership, policies, domain services, data persistence and public API contracts.

Trainer capability is additive to an athlete account; a trainer keeps the ability to track their own workouts. The server, never client navigation or a UI role check alone, determines authorization. Admin privileged session policy is separate. No second `User`, auth database, trainer API service, microservice, or automatic role self-grant.

## Verified route inventory in `main` (2026-11-19)

These are **current file-backed routes**, not promises that the future Trainer app already implements them.

- **`/dashboard`** — current: `apps/web/src/app/(protected)/dashboard/page.tsx`; target: Athlete Web; cutover: Retain.
- **`/workouts`, `/workouts/new`, `/workouts/[id]`** — current: `apps/web/src/app/(protected)/workouts/`; target: Athlete Web; cutover: Retain.
- **`/exercises`, `/exercises/new`, `/exercises/[id]`** — current: `apps/web/src/app/(protected)/exercises/`; target: Athlete Web; cutover: Retain; keep current owner policies.
- **`/profile`, `/athlete/programs`, `/athlete/trainers`** — current: `apps/web/src/app/(protected)/`; target: Athlete Web; cutover: Retain athlete flows.
- **`/trainer/athletes`** — current: `apps/web/src/app/(protected)/trainer/athletes/page.tsx`; target: Trainer Web; cutover: Migrate after capability and client-list parity.
- **`/trainer/programs`, `/trainer/programs/new`, `/trainer/programs/[programId]`** — current: `apps/web/src/app/(protected)/trainer/programs/`; target: Trainer Web; cutover: Migrate after builder/version/locale parity.
- **`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`** — current: `apps/web/src/app/`; target: Athlete Web; cutover: Retain; future Trainer sign-in reuses same identity, not necessarily these URLs.
- **`/sign-in`, `/`** — current: `apps/admin/src/app/`; target: Admin Web; cutover: Retain privileged admin boundary.
- **`/trainer/athletes` (Expo route)** — current: `apps/mobile/src/app/trainer/athletes.tsx`; target: Athlete Mobile scope review; cutover: Audit in #368; do not silently remove deep links or athlete functionality.
- **`/for-trainers`, `/apps/*`** — current: `apps/landing/src/app/`; target: Landing; cutover: Add Trainer product links only after usable destination/host exists.

Other verified Expo routes under `apps/mobile/src/app/` include `(tabs)`, `exercises/index`, `profile/edit`, `programs/[id]`, `progress/index`, `progress/exercises/[id]`, `sign-in`, `workouts/new` and `workouts/[id]`. They remain Athlete Mobile surfaces. Expo `Stack.Protected` currently branches on `account.role`; this is **not** evidence of complete multi-capability support or a security boundary.

The current Web protected layout is visual only and explicitly says each protected page verifies its own server session. Trainer Web must retain this guarantee rather than relying on layout caching or client-side role hiding.

## Migration contract and dependency order

- **1** — **#359 (this ADR)**; proof: Owners, route inventory, compatibility contract and ordered plan.
- **2** — #360, #288, #291; proof: Audit API module boundaries and role/capability policies; no direct repository leaks.
- **3** — #362; proof: Independent `@gym/trainer` Next.js/Turborepo scaffold; OVRANTO design tokens, i18n and typed API client.
- **4** — #309 → #310 → #311, #361; proof: Trainer profile/application state machine, admin approval/revocation, dual-capability security tests.
- **5** — #363; proof: Trainer host-only cookie/same-origin proxy, guarded routes; explicit 401/403/revoked/pending UX.
- **6** — #312 → #364; proof: Bounded trainer dashboard API, then Trainer Web views.
- **7** — #336–338, existing PR #271/#275, then #365; proof: Stabilize builder behavior and localizations; move to focused 3-pane Trainer editor with approved OVRANTO UX.
- **8** — #339, #301–304, #366; proof: Authorized feedback, templates and assignment UI, no duplicated backend.
- **9** — #369 plus #389; proof: Auth/permission/browser E2E, responsive/a11y, CI affected-workspace and release evidence.
- **10** — **#367 only after parity**; proof: Compatibility links/redirects and deliberate removal of legacy Web trainer-only UI.
- **Parallel review** — #368; proof: Mobile trainer-only audit, safe deep-link policy, no premature removal.

The precise order inside dependent groups can be refined when testable contracts exist. Bootstrap #362 may proceed before all capability changes, but **must not expose privileged data or impersonate a working Trainer login**.

## Legacy URL and session compatibility

1. Keep existing `/trainer/*` Web routes operational until Trainer Web is deployed, authorized and functionally equivalent. No blanket redirect or early deletion.
2. After cutover, document exact old→new route mappings (including encoded `programId`) and choose temporary cross-product navigation before permanent redirects. Permanent 301/308 is **not** approved until hostnames and backward-compatibility gates are signed off.
3. Never put session tokens, bearer tokens or one-time secrets in redirect URLs. Browser sessions use trusted, host-scoped HttpOnly cookies and same-origin API proxy; a cookie for Athlete Web is **not assumed** to authenticate Trainer Web automatically.
4. Cross-product navigation may require a fresh login on the Trainer host. Any future single sign-on must be explicitly designed and security-reviewed; it is not a side effect of redirects.
5. Maintain `/users/me` compatibility for existing Web/Mobile clients while capability-aware contracts are added. Role-only guards in current Web and Expo are migration debt, **not** justification for client-side authorization.
6. On disabled/revoked Trainer capability, block Trainer access at the API and refresh/revoke relevant session permissions per #291/#311/#361. A trainer must still access their athlete data.
7. Keep shared `@gym/api-client`, `@gym/i18n`, `@gym/design-tokens`, `@gym/ui-web` and `@gym/domain` as appropriate. App-specific navigation, cookies and route shells stay within their owning apps.

## Existing PR overlap — preserve, do not duplicate

- [#271](https://github.com/sauron9521/gym-platform/pull/271): localized **existing Web** trainer program list; it is stacked on another i18n PR. Review and merge in base order, then reuse translations in Trainer migration.
- [#275](https://github.com/sauron9521/gym-platform/pull/275): existing Web program-builder week filter; keep feature behavior, migrate only after review/merge.
- Shared i18n/UI PR stack and OVRANTO system (E19/E20) are independent dependencies. Avoid copying legacy Athlete Web CSS as the final Trainer shell.
- #320/#336–339 own **builder functionality**, #355/#365–366 own **UI relocation**, #381/#386 own **approved UX**, and #389 owns **manual visual/a11y acceptance**.

## Verification / rollback gates

- **This ADR:** documentation-only; no routes, database migrations, deployment, permissions or session behavior changed.
- **Each implementation PR:** targeted lint, typecheck, relevant unit/integration/browser or native E2E, fresh `main` diff and green GitHub Actions.
- **Before cutover:** an actual Trainer-host login and permission matrix (unauthenticated, athlete-only, pending, approved, revoked, admin), both themes, uk/en, keyboard/mobile viewport, old links, browser refresh, API-denied responses, and unchanged Athlete Web/Mobile flows.
- **Rollback:** preserve old Web trainer routes until parity and deployment sign-off. Defer redirect toggles if staging evidence is incomplete.
- **Authority:** repository owner manually merges each PR. This ADR does **not** approve a production rollout, destructive migration, or automatic PR merge.
