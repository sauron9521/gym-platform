# Shared API client

`@gym/api-client` is a small, platform-independent, **fully typed** HTTP client for
the NestJS API. Both Next.js and Expo import the same client and types.

- `openapi-fetch` handles HTTP with a configurable `fetch`, `baseUrl` and
  credentials; this package never reads or stores secrets or session tokens.
- `openapi-typescript` generates request and response types from the **actual**
  NestJS Swagger contract. No hand-written DTO duplication.
- `src/generated/schema.d.ts` is intentionally committed, so consumers can
  typecheck and build immediately after `pnpm install`.
- `apps/api/openapi/openapi.json` is the corresponding committed OpenAPI snapshot.

## Usage

```ts
import { createGymApiClient } from '@gym/api-client';

const api = createGymApiClient({
  baseUrl: 'http://localhost:3001',
  credentials: 'include', // Browser-only session cookies, with CORS enabled on API
});

const { data, error } = await api.GET('/health/live');
```

The typed client does not automatically use browser cookies, access tokens,
local storage or any secret. For Expo native devices, configure a reachable
API URL (`localhost` refers to the device itself). Token storage and
refresh-session strategies are deferred to the authentication integration PR.

## Regenerate after an API contract change

From the monorepo root, after generating the Prisma client and configuring
a **non-production** API environment:

```sh
pnpm --filter @gym/api db:generate
pnpm api:contract:generate
pnpm api:contract:check
```

The exporter uses `apps/api/src/infra/openapi/export-openapi.ts`; no running
public API server is required. CI regenerates the OpenAPI file and TypeScript
types in its isolated PostgreSQL job and checks for uncommitted differences.

Do not edit generated snapshots manually or include credentials in OpenAPI
descriptions.

## Authentication adapters

`createBrowserSessionClient({ baseUrl, onAuthFailure? })` opts into browser
HttpOnly session cookies via `credentials: 'include'`. The API must allow the
Web origin through credentialed CORS, and the server's CSRF requirements must
still be satisfied. Do **not** reuse the browser singleton for Next.js SSR:
server-side requests do not automatically forward the user's cookies.

`createBearerTokenClient({ baseUrl, getAccessToken, onAuthFailure? })`
fetches a short-lived bearer token from the caller for every request. It
does not read storage, refresh credentials, follow redirects, or send cookies.
Access tokens are never sent to a different origin than `baseUrl`.

`onAuthFailure` receives `'unauthenticated'` for HTTP 401 or `'forbidden'`
for HTTP 403. The original response remains available through `openapi-fetch`.
No automatic retry or logout is performed; UI-level behavior belongs to
the consuming app.

Use `POST /auth/login` and `POST /auth/sign-out` for browser sessions;
the native token flow uses `POST /auth/token` and
`POST /auth/token/refresh`. The token-refresh lifecycle, secure
storage, and API response-schema annotations will be handled separately.
