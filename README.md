# Gym Platform

Monorepo for Gym App, powered by pnpm Workspaces and Turborepo.

## Repository layout

- `apps/` — NestJS API, Next.js Web, and Expo Mobile (added incrementally).
- `packages/` — shared libraries, types, and generated API clients.
- `tooling/` — shared development configuration.
- `infra/` — Docker and deployment infrastructure.

## Local setup

Requirements: Node.js 24 and pnpm 12 (the exact pnpm version is pinned in `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Local development

Requires Docker Desktop/Engine and Docker Compose v2.
The local services use PostgreSQL 17 and Redis 7; API, Web, and Mobile run on the host.

```powershell
Copy-Item infra/docker/.env.example infra/docker/.env
Copy-Item apps/api/.env.local.example apps/api/.env
pnpm db:up
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:3001.
The sample credentials are local placeholders; customize matching passwords
in both untracked `.env` files. See [local services](infra/docker/README.md)
for stopping services, persistent volumes and safety notes.

To start applications individually, use `pnpm dev:web`, `pnpm dev:api`,
or `pnpm dev:mobile`.

## Contribution workflow

Open a pull request against `main`. CI verifies formatting and workspace quality tasks.
Only the repository owner merges approved changes.


## Typed API contract

Both frontends depend on `@gym/api-client` in `packages/api-client`.
Types are generated from the NestJS OpenAPI schema and checked in CI.

After changing API routes or DTOs, run `pnpm api:contract:generate` and commit
the updated `apps/api/openapi/openapi.json` and `packages/api-client/src/generated/schema.d.ts`
alongside the API change. See [client documentation](packages/api-client/README.md).
