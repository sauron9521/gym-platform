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
