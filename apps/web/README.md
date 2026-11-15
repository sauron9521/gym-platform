# Gym Platform Web

Next.js App Router + TypeScript + Tailwind CSS 4 + shadcn/ui, managed by pnpm Workspaces and Turborepo.

## Start

From the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gym/web dev
```

Open http://localhost:3000.

## Quality checks

```bash
pnpm --filter @gym/web lint
pnpm --filter @gym/web typecheck
pnpm --filter @gym/web test
pnpm --filter @gym/web build
```

## Architecture

- `src/app/` — Next.js routing, layouts, and global styles.
- `src/widgets/` — page-level sections (Feature-Sliced Design).
- `src/shared/ui/` — reusable shadcn/ui components.
- `src/shared/lib/` — shared utilities.

Add shadcn/ui components from `apps/web` with `pnpm dlx shadcn@latest add <component>`.
Keep code in the appropriate FSD slice; do not add a Next.js `src/pages` directory.

## Browser authentication foundation

`src/shared/api/client.ts` wraps `@gym/api-client` with browser-session
cookies (`credentials: 'include'`). A 401 means unauthenticated; a 403
means insufficient permissions. The `onAuthFailure` callback can update
client-side UI state without consuming the response.

This is a browser-only adapter. **Next.js Server Components must not reuse
its singleton** for authenticated requests: pass cookies explicitly through
a server-side boundary, with appropriate authorization and CSRF checks.
`/login` provides browser sign-in using the generated `@gym/api-client` contract.
It confirms the HttpOnly session through `GET /users/me` before redirecting to
`/dashboard`. The dashboard renders no private information until that check
succeeds. HTTP 401 redirects to `/login`; HTTP 403 shows an access error; network
failures are retryable. Sign-out calls `POST /auth/sign-out` and clears the
server-side session (no JWTs or browser token storage).

For local development set GYM_API_INTERNAL_URL=http://localhost:3001 in
apps/web/.env.local, plus APP_URL=http://localhost:3000 and
CORS_ORIGINS=http://localhost:3000 in the API environment.

## Server-side browser sessions

- Browser calls to /backend/* are proxied by Next.js to the fixed API origin,
  so the API's host-only HttpOnly session cookie is scoped to the web host.
- Deployments MUST set GYM_API_INTERNAL_URL to a trusted HTTP(S) API origin at
  build time and runtime. The localhost default is only for development/CI.
- Next.js server pages forward the incoming Cookie header to NestJS /users/me
  with cache: no-store, no redirects, and a bounded timeout.
- Every protected page must perform its OWN session check. Layouts are cached
  by the Next.js client router and MUST NOT be treated as an auth guard.
- 401 redirects to login; 403 and backend failures render no private content.
  API authentication/authorization still secures every data operation.
- Production: serve the web via HTTPS, confirm cookie HttpOnly/Secure/SameSite
  flags and host-only Domain, and keep the internal API origin trusted.
  Configure NestJS APP_URL to the public web origin for session/CSRF validation.
- Do not call the backend directly from browser code or persist access tokens.
  MFA challenge UI remains a separate PR.

## Registration flow

The public `/register` route uses the existing generated OpenAPI contract
(`POST /auth/register`) and sends only email and password to NestJS.
The browser never stores bearer tokens. The backend enforces password strength,
uniqueness, rate limits and email verification policy; frontend checks only
basic input completeness and matching passwords. HTTP 409 (existing email),
400 (invalid input), 403 (origin security), 429 (rate limit) and network errors
have distinct user-facing messages without exposing backend internals.

Registration creates a session server-side. On HTTP 201 the screen shows
whether verification email submission was `SUBMITTED` or
`RETRY_REQUIRED`; neither status guarantees that the email is verified.
The screen does **not** assume a verified email or automatically redirect
past an authentication check. The existing `/dashboard` route verifies the
session independently via `GET /users/me`. Email confirmation, resend and
password recovery are already implemented at `/verify-email`,
`/verify-email/resend`, `/forgot-password` and `/reset-password`.

## Email verification and resend

The API creates a verification link using `APP_URL/verify-email?token=...`.
The public `/verify-email` page checks the token's shape and **only
consumes the one-time token after an explicit click**, never on a GET or
automatically during hydration (mail scanners may open links). The
browser removes the token query from its address bar during hydration
without reloading, never renders or logs the token, and requests the
same-origin typed `POST /auth/email/verify` with `{ token }`.
The page is noindex/no-referrer and only HTTP 200 is considered confirmed;
HTTP 400 includes expired/replayed links. Do not claim success after
a failed request or infer verification from a logged-in session.

`/verify-email/resend` calls `POST /auth/email/verification` **only
on an explicit button click**. The API sends to the authenticated
user's own email, so there is no free-form email input; HTTP 401
requires sign-in, 409 means already verified, 429 means throttling,
503 means the mailer is unavailable, and 202 means only that the
send request was accepted, not that the message was delivered.
The browser never holds an access token and the Web app continues
to use HttpOnly session cookies through `/backend`.

For local email links, set `APP_URL=http://localhost:3000` in the API
environment. Configure HTTPS, cache/referrer policies and access log
redaction for query strings at the reverse proxy in any deployment.
Actual deliverability, mailer availability and end-to-end confirmation
against a live server require manual integration verification.

## Password recovery

The public `/forgot-password` page submits only a normalized email
to `POST /auth/password-reset/forgot`. HTTP 202 shows the **same generic
message** for existing and nonexistent accounts, without revealing which
accounts are registered. Throttling and transport errors are surfaced as
operational failures, not account-existence claims.

NestJS generates links to `APP_URL/reset-password?token=...`. The
`/reset-password` page parses and bounds the token, uses `noindex`
and `no-referrer` metadata and removes the token from visible browser
history on hydration. A GET never consumes the token: only an explicit
form submission calls `POST /auth/password-reset/reset` with the
opaque token and new password. The browser never renders, logs or stores
reset tokens in local/session storage, or treats HTTP 200 alone as
authorization to enter private pages.

Password complexity and token validity are enforced by NestJS. Client
checks only length, whitespace and matching confirmation. Reset errors
are derived from HTTP status, not untrusted API response bodies. The API
may create an authenticated or MFA-pending session during reset, so the
screen directs the user to the existing login flow; it never bypasses
the independently protected dashboard.

Set `APP_URL=http://localhost:3000` locally. Deployments require
HTTPS, query-string redaction in all reverse-proxy/access logs, secure
session cookies and real SMTP checks. Email delivery and end-to-end
password recovery against a live server are not claimed by offline CI.

## User profile

The dynamic /profile route verifies the cookie-backed session server-side before rendering any private UI. Its client form loads profile data using the typed same-origin GET /users/me and updates using PATCH /users/me. PATCH 200 has no response body in OpenAPI; the UI re-reads GET after successful changes. Weight and height accept decimal values; nullable fields can be cleared. Email and account role are read-only. Avatar upload, replacement and removal are implemented on the same profile page (see below). Tokens and raw API errors are never displayed or stored in browser storage.

## Avatar management

The authenticated /profile page displays a backend-managed avatar from GET /users/me.
Only canonical /avatars/<uuid>.(png|jpg|webp) paths are accepted and mapped to
same-origin /backend/avatars/*, never arbitrary external URLs. Image files are
posted using native multipart FormData with field "file" to POST /users/me/avatar.
DELETE /users/me/avatar removes the avatar only after explicit confirmation.
Both mutations re-read GET /users/me; on failure the UI does not claim success.
Client-side guards allow PNG/JPEG/WebP up to 2 MiB, while the API remains
authoritative for image content validation and dimensions. No bearer tokens,
image blobs, or arbitrary upstream errors are stored or logged. No new packages.

## Profile forms (React Hook Form + Zod)

The profile editor uses React Hook Form for field lifecycle, dirty state,
submit handling and accessible inline errors. Zod 4 validates the input via
`zodResolver(profileSchema)` and the same schema is rechecked before building
the typed `PATCH /users/me` payload. Height is an integer between 50 and 300
centimeters, weight has up to two decimal places between 1 and 600 kg and
timezones use IANA names. The API remains authoritative.

Authentication, session verification and avatar upload remain unchanged.
Avoid rewriting other forms in this PR; migrate them in focused follow-ups.

## Login form validation

The login form uses React Hook Form with the Zod resolver. It trims and
validates the email address, checks for a non-blank password without
transforming password bytes, and displays accessible field errors. It keeps
the existing MFA-pending safeguard and verifies the session through
`GET /users/me` before routing to the dashboard. Backend authorization,
rate limiting and credentials checks remain authoritative.

## Registration form (React Hook Form + Zod)

The public /register form uses React Hook Form and Zod 4 for email normalization,
minimum password length and matching confirmation. Field-level messages are
accessible via aria-invalid and aria-describedby. Only email and the unchanged
password are sent through the typed same-origin POST /auth/register. On HTTP 201,
the form clears credentials and preserves the distinction between accepted
verification email submission and successful email verification. NestJS remains
authoritative for password strength, account creation and rate limiting.

## Workout journal (create, edit and log sets)

The private `/workouts` route checks the HttpOnly session on every server page
request before rendering the browser list. It uses `GET /workouts` through the
same-origin typed `@gym/api-client` adapter with `view=summary`, a page size of
10, optional status filtering and server-provided pagination metadata. The API
remains authoritative for access controls. HTTP 401 returns to sign-in; HTTP
403, API errors and network outages never display private workout data.

The list distinguishes PLANNED, IN_PROGRESS, COMPLETED and CANCELLED workouts,
shows scheduled dates and exercise counts when available, and handles loading,
empty, error and retry states. At `/workouts/new`, an authenticated user with workout permissions
can choose exercises and planned sets, then persist a workout through
`POST /workouts`. `/workouts/:id` shows details and supports editing name/notes for
PLANNED workouts, starting/cancelling/completing a workout, and recording or
correcting actual set results while it is IN_PROGRESS. These writes go through
the typed same-origin API; the backend enforces ownership and state transitions.
No browser token storage.

## Exercise library

`/exercises` shows the searchable, paginated catalogue with type and taxonomy
filters. `/exercises/new` lets authenticated athletes/trainers create a custom
exercise with muscle groups and optional equipment. Athletes can choose private
visibility or selected-trainer access (which still requires a separate grant).
`/exercises/:id` shows details and allows the owner to edit or archive their
custom exercise. Global exercises are not editable by ordinary athletes, and
private exercises remain invisible to unrelated users. These permissions are
validated by NestJS, not merely by hidden Web controls.

## Trainer–athlete relationships and training programs

`/trainer/athletes` and `/athlete/trainers` provide role-specific relationship
lists with invitations, status filters and available relationship actions.
`/trainer/programs` lists a trainer's programs and versions with pagination and
status filters; `/athlete/programs` lists assigned programs. The trainer-only
`/trainer/programs/new` page uses React Hook Form + Zod and the typed same-origin
`POST /training-programs` operation to create version 1 as a **DRAFT**. Title
is required (2–120 characters), while description (up to 5000 characters) and
duration (1–52 weeks) are optional. The API remains authoritative for role
checks and validation; 401 redirects to login and other errors never expose
raw server messages. A successful create returns to the owned program list.

Trainers can open `/trainer/programs/[programId]` to see the latest version,
status, description and duration. For an active DRAFT, React Hook Form + Zod
validates edits and uses the generated API client for
`PATCH /training-programs/{programId}/versions/{versionId}`. Empty description
and duration fields intentionally send `null` to clear saved values. The
backend enforces ownership, immutable published versions, archive restrictions
and week-duration consistency. Only a successfully saved version updates the
display; HTTP 409 prompts a reload, and 401 redirects to login. The page
verifies its own server session and hides foreign or unavailable programs.

This first details view only shows the **latest version summary**, not the
complete version history or a visual workout/version builder. Program
workout composition, publishing, and assignment remain future Web work.

## Browser E2E (Playwright + Chromium)

Browser tests live in `apps/web/e2e/specs/` and use the **real Next.js UI**
and its same-origin `/backend` rewrite. An isolated, loopback-only Node HTTP
fixture API in `e2e/support/mock-api.mjs` supplies deterministic authentication,
role, profile and workout responses. **No real user accounts, secrets or
production/staging databases are accessed.** API behavior is intentionally
limited to the endpoints exercised by these browser scenarios.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gym/web exec playwright install chromium
pnpm --filter @gym/web test:e2e
```

Playwright starts and stops the fixture API on `127.0.0.1:3101` and Next.js on
`127.0.0.1:3100`. Both ports must be available. It deliberately refuses to
reuse a server on either port, to avoid testing against a real local API by
accident. No `.env.local` or remote API configuration is required.

The browser suite covers: anonymous redirects, unsuccessful login, client-side
validation, HttpOnly cookie session and sign-out, profile edit/reload, workout
listing/filtering, and athlete/trainer role isolation. It runs separately from
fast Node unit tests via `test:e2e`.

GitHub Actions executes the browser suite whenever Web or shared dependencies
change. The protected `Quality / Node 24` check fails if the browser job
fails or does not run when required. On failure, a short-retention trace,
screenshot and HTML report artifact is uploaded for debugging.

**Scope limit:** This verifies browser routing, UI behavior, cookie proxying
and expected HTTP contracts against a deterministic fixture API. Real NestJS,
PostgreSQL, Redis, migrations and true authorization are exercised by the
separate API integration/E2E suite, not the fixture server. An additional
Web-to-real-Nest integration suite is available separately as described below.

## Browser integration with the real API

`pnpm --filter @gym/web test:e2e:integration` runs Chromium against real NestJS,
Next.js and PostgreSQL. Set identical `DATABASE_URL` and `TEST_DATABASE_URL` values
pointing to a disposable loopback PostgreSQL database whose name ends in `_test`.
Generate Prisma, apply migrations and build the API before running the suite:

```bash
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm --filter @gym/api build
pnpm --filter @gym/web test:e2e:integration
```

Provide the API's required test JWT/environment settings. The suite reserves
ports 3200/3201 and creates unique users in the disposable database. It covers
login, secure HttpOnly cookies, profile persistence, role isolation and session
revocation, plus browser creation/editing of workouts and sets and creation/editing
of private exercises. The privacy scenario confirms that guests and unrelated
athletes cannot read or mutate another user's private exercise. Twelve authenticated
profile reads within one minute guard against the former 10/minute limit; an
independent HTTP context also requires 401 when replaying a revoked session.

The integration spec files live in `e2e/integration/`. The `test:e2e:integration`
command runs **every spec in a separate Playwright invocation**, restarting its
disposable API/Web servers between files to preserve the real API's per-IP
registration rate limit. Do not bypass throttling, reuse an existing server or
point the test database at production. The `Web / Real API and PostgreSQL`
required CI check provisions disposable PostgreSQL, applies the initial Prisma
baseline and seeds exercise taxonomy. Failure traces are retained; no existing
database is reset.
