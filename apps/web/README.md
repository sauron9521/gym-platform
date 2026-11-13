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
  MFA challenge UI, registration and password recovery are separate PRs.
