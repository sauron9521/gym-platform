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

## Trainer Dashboard — recent owned program preview (#364)

The existing protected Trainer Dashboard also shows the five most recently
updated programs belonging to the approved trainer, using the existing typed
`GET /training-programs?page=1&limit=5` API. Server-side authorization checks
the current Trainer grant and filters SQL by `trainerId` before pagination.
A program preview is **not** an active athlete assignment: the existing KPI
continues to report assigned program counts separately.

The preview displays each program's latest version title and its actual
draft/published/archived status, plus the API's total program count. It is
**read-only**; the separate Trainer Program Builder remains owned by #365.
The client never receives arbitrary unbounded program rows, credentials or
unapproved trainer program data. API 401/403 invalidates the entire protected
workspace even after a previous capability read; API outage/invalid response
hides only the program preview and renders a retry. True empty results show
"No programs yet", not a fabricated zero in place of a failed fetch.

Relevant tests cover trusted origin, exact five-item limit, malformed payloads,
empty and revoked states. The real Trainer browser/PostgreSQL test seeds
one owned and one foreign trainer program and asserts only the owned preview.

## Trainer individual client progress (#364, API #487)

The protected dynamic `/workspace/clients/[relationId]` route is linked only
from the server-validated, paginated **active trainer-owned client list**.
It first checks the current Trainer grant. It then uses the existing typed
`GET /trainer-dashboard/clients/:relationId/progress` backend authorization
(approved trainer + ACTIVE owner relationship + assigned-program counts) and,
**only after success**, reads `GET /trainer-athletes/:id` for the client's
contact email. Both requests share the existing strict host-only cookie,
trusted-origin, no-cache, no-redirect, five-second timeout transport.

No email, counts or other private data render unless **both** responses are
200 with matching ACTIVE relationship identity and valid progress metrics.
Invalid/non-UUID IDs never hit the API. Missing, foreign, closed or redacted
relationships show an identical generic not-found state. A moderation/session
change between the permission check and either read fails closed with a
sign-in/denied state. Outages or malformed data display a retryable unavailable
state, not false zero counts. True zero values remain visible with an empty
state. Counts include **only the trainer's assigned-program activity**, never
all of an athlete's personal workout history.

All labels are localized uk/en; the page is `noindex` and server-rendered
without prefetch of private links. Unit tests cover the transport, shape
validation, timing/ownership, 401/403/404 and failure cases. The existing
real browser/Nest/PostgreSQL Trainer E2E verifies navigation, own versus
foreign clients, revocation and ended collaboration. No new API, Prisma
migration, client-side auth store, or workout permission widening.

## Trainer client assigned programs — summary list (#364/#366)

The existing protected `/workspace/clients/[relationId]` page now shows
a separate **bounded read-only** list of programs assigned to that active
client. It calls only the existing
`GET /training-programs/assignments?trainerAthleteId=...&view=summary&page=N&limit=8`
API introduced in #489 **after** fresh trainer capability and
`/trainer-dashboard/clients/:relationId/progress` plus ACTIVE relationship
checks. The Nest API filters rows and count by trainer/relationship in SQL
_before_ pagination; no client-side filter of participant-wide history.

- Displays assigned version title/number, assignment status
  ACTIVE/COMPLETED/CANCELLED/TERMINATED and total, with uk/en copy.
  An empty first page, an out-of-range page and a failed request have
  **distinct** states. Invalid page parameters normalize to page 1.
- A post-progress API 401/403/404 hides **the entire private client
  page**, not just this section, to handle revocation/termination races.
  5xx, malformed payload and timeout isolate the assignment section with
  a retry link; valid zero metrics and contact stay available.
- Strict server-side checks reject mismatched relationship IDs, redacted
  response rows, wrong program trainer IDs, duplicates, unexpected status
  or pagination metadata; no historical assignment email/workout arrays
  are passed to the browser.
- Links are no-prefetch, dynamic SSR, noindex. Uses the existing trusted
  host-only cookie transport, `@gym/api-client`, Next/i18n/layout and
  database. No write endpoints, dependency or schema changes.
- Unit tests cover real request shape, eight-item bounds and page selection,
  401/403/404 and redaction, malformed data, origins and timeout; the
  real-browser/PostgreSQL Trainer integration adds 9 owned + 1 foreign
  assignment fixtures, tests pages 1/2 and deletion after the suite.

## Trainer read-only published program/version chooser (#366)

The client progress page links to the protected dynamic
`/workspace/clients/[relationId]/select-program` **GET-only** route.
It first verifies a current persisted Trainer grant and loads the client's
ACTIVE owner-scoped progress + matching relation/contact using existing
read models. Only then does it list up to **8 owned PUBLISHED programs per page**
from the existing typed `GET /training-programs?status=PUBLISHED` API.
A selected program must exist on **that exact paginated owner-scoped page**
before the server may call existing `GET /training-programs/:id/versions`.

- Only **PUBLISHED** versions are displayed as choices. Latest-title
  previews on a published program may themselves be a DRAFT; the UI labels
  this explicitly and _never_ offers a draft version. Archived/draft programs
  and foreign trainer programs cannot become selectable.
- SSR query params `page`, `programId` and `versionId` are validated.
  Bad page numbers normalize to 1; invalid/foreign program IDs do not trigger
  an arbitrary `:id/versions` request. A selected version must match one of
  the validated published rows, never just a user-supplied UUID.
- The existing trusted host-only cookie transport uses `no-store`, rejects
  redirects and bounds each request to five seconds. Any 401/403 **during
  either follow-up read hides all earlier client data**; 5xx, malformed data,
  missing or archived programs show safe unavailable/not-found states.
  The version list is capped at 40 rows and malformed/cross-program data
  never enters the UI. Real owned program pagination is server-side.
- `GET /training-programs` and `GET /training-programs/:id/versions`
  use the existing centralized `RateLimit('read')` preset (60/minute).
  The former 10/minute global preset exhausted during legitimate SSR
  chooser navigation; this changes **only** these two owner-scoped read
  handlers, not mutation budgets or the global policy.
- There are **no writes, assignment creation, client-side session state or
  automatic confirmation**. A selected version is only reflected in a
  server-rendered confirmation that explicitly says nothing has been saved.
  The actual create assignment action and conflict/retry semantics are
  a separate follow-up PR.
- uk/en responsive noindex route, unit transport/auth/selection tests and
  real Trainer Next/Nest/PostgreSQL browser verification cover client eligibility,
  published/draft/foreign boundaries, selection and no mutations.

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
