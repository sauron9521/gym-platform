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
  MFA challenge UI and password recovery are separate PRs.

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
password recovery UI will follow in separate small PRs.

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
