# OVRANTO Trainer Web

Independent **Trainer** Next.js 16 + React 19 application in the existing pnpm/Turborepo workspace. This is the M05/#362 **bootstrap**, not the finished trainer product.

## Local development

Run from the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm dev:trainer
```

Open http://localhost:3004. Other local ports remain API 3001, Landing 3002, Admin 3003 and Athlete Web as configured. Set `GYM_API_INTERNAL_URL` using `.env.example` only to a trusted server origin; never use `NEXT_PUBLIC_*` for an internal API URL.

```bash
pnpm --filter @gym/trainer lint
pnpm --filter @gym/trainer typecheck
pnpm --filter @gym/trainer test
pnpm --filter @gym/trainer build
```

## Trainer Dashboard — live client list and KPIs (#364)

The protected dynamic `/workspace` performs a fresh persisted Trainer capability
check before requesting private data. It then runs two independent, uncached
read models via the shared typed `@gym/api-client` transport:

- `GET /trainer-athletes?scope=trainer&status=ACTIVE&limit=8&page=N`:
  bounded client list and pagination, where API SQL scopes active relationships
  to the trainer **before** COUNT/LIMIT/OFFSET. Existing callers are unchanged.
- `GET /trainer-dashboard/overview` (backend #312, merged #473): three
  bounded PostgreSQL counts: active clients; active program assignments;
  **completed assigned-program** workouts in the last 30 days. Progress is
  _not_ all personal workouts, and program count is _not_ a number of templates.

The shared SSR transport accepts only a configured trusted origin, forwards
host-only session cookies to that origin only, rejects redirects, uses
`no-store` and a five-second timeout. An unauthenticated/forbidden response
from **either** read invalidates the whole private workspace even if the other
completed successfully (handles post-capability-check revocation). A malformed,
failed or unavailable overview displays an explicit unavailable state in each
KPI card; it never fabricates zeros. A true empty result shows numeric `0`.
A client list outage is isolated from an otherwise valid KPI overview.
Messages and exact 30-day/assignment semantics are available in uk/en.

Unit contracts cover missing cookie, status and malformed response, zero versus
unavailable, unsafe origin and strict SSR transport. The real
`trainer-web-auth.spec.ts` browser/PostgreSQL E2E verifies authorized
0/1 aggregates, other-trainer isolation, revocation and expired sessions.

## Real-browser security regression

The existing `Web / Integration E2E` workflow runs
`apps/web/e2e/integration/trainer-web-auth.spec.ts` against real NestJS,
PostgreSQL, and the independent Trainer Next app; it is not a mocked auth test.
The Trainer server only starts for that spec. `127.0.0.1:3200` (Athlete Web)
and `localhost:3202` (Trainer Web) are intentionally **different hosts**
so host-only session cookie isolation can be asserted.

The test checks unauthenticated and pending Trainer access, approval,
revocation, ADMIN denial, rejected forged Origin, cookie flags and host isolation,
and actual sign-out with subsequent 401. It uses **only** the disposable
`*_test` database guarded by the existing Web integration harness; the test
creates a reviewer fixture directly in that database and removes it afterward.
Never run it against development or production databases.

Run with the existing Playwright PostgreSQL setup using the documented Web
integration environment; use `WEB_E2E_TRAINER=1` to start Trainer when
running this one spec directly. CI sets that flag automatically for
`trainer-web-auth.spec.ts` and includes changes under `apps/trainer/**`
in the browser-regression trigger.

## Product and security boundaries

- One existing `User` identity and one NestJS API. No second Trainer users/passwords/service.
- `src/app` owns routes, `src/widgets` owns presentation shell and `src/shared` holds local utilities following FSD boundaries.
- Use `@gym/design-tokens/ovranto.css`, `@gym/ui-web`, `@gym/i18n` and `@gym/api-client`. No copied Athlete Web component tree.
- Root displays **only public bootstrap information**, never mock athlete data, private API responses or role-based content. Sidebar links to unimplemented features are disabled and do not imply access.
- `/workspace` is a protected, dynamic, uncached server dashboard. It first verifies `/users/me/capabilities` (requires `trainer: true`, `admin: false`), then loads real client data **only** from the trusted Nest API with the request's host-only Cookie header. Missing/expired/revoked grants, invalid responses, redirects and network outages fail closed and never expose stale client data.
- `/login` uses browser credentials against same-origin `/backend/auth/login` (the existing NestJS login), validates `/backend/users/me/capabilities` before entering `/workspace`, and best-effort signs out newly issued unapproved/MFA sessions. Only the API issues the host-only session cookie; the client never reads session tokens. Set API `TRAINER_APP_URL` to the exact Trainer origin (and add it to `CORS_ORIGINS`); Nest already checks CSRF Origin for cookie-auth writes.
- The protected `/workspace` exposes **Sign out** only after server-side live capability verification. It posts to the existing Nest `POST /auth/sign-out` via `/backend` with same-origin cookies, no redirects and no cache. A 204 response or an expired session (401) returns to `/login`; 403, 429, 5xx, network errors and unexpected responses retain the current UI with a retryable error. The control disables itself during requests and ignores double-clicks. Sign-out never relies on a client-only cookie deletion or on JWT/local storage.
- **No private-data authorization happens in client code.** `/workspace` rechecks live server grants and the Nest API enforces active-relationship row visibility at query time. The new `scope=trainer` list filter scopes SQL counts/pagination to collaborations where the signed-in identity is the trainer (not athlete-side relationships). No extra passwords, new JWTs, or migrations.
- The shared `gym-locale` cookie controls uk/en with Accept-Language fallback, and `ovranto-theme` follows OS Light/Dark by default with manual override. Cookie values never confer privileges.
- This app has `robots: noindex` until a controlled release and verified auth. No production domain or deployment is enabled here.
- Subsequent work: #364 detailed athlete progress/tasks and program lists, #365 focused 3-pane Program Builder, #366 assignments/feedback, #369 browser E2E/CI release gating.

Architecture: [ADR-005](../../docs/architecture/adr-005-product-ownership-trainer-migration.md). Visual design: OVRANTO Premium Athletic Minimal, full Light/Dark, responsive sidebar; builder remains a separate step.
