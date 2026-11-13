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

For local development use `NEXT_PUBLIC_API_URL=http://localhost:3001` in
`apps/web/.env.local`, `APP_URL=http://localhost:3000` and
`CORS_ORIGINS=http://localhost:3000,http://localhost:3001` in the API environment.
NestJS CSRF protection and the session provider trust **only** the configured
`APP_URL` origin for cross-origin browser writes. CORS alone does not authorize
cookie-based writes. For production, serve the web and API over HTTPS on
same-site hosts; cross-site cookies require additional deliberate configuration.

MFA challenge UI, registration, password recovery and **server-side** route
protection are separate follow-up work. Client gating is a UX measure, not a
substitute for API authentication/authorization.
