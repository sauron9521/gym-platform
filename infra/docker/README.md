# Local services for Gym Platform

This Docker Compose stack starts only **PostgreSQL 17** and **Redis 7**.
The NestJS API, Next.js Web and Expo Mobile run on your host using pnpm.

## Quick start (PowerShell)

From the monorepo root:

```powershell
Copy-Item infra/docker/.env.example infra/docker/.env
Copy-Item apps/api/.env.local.example apps/api/.env
pnpm install --frozen-lockfile
pnpm db:up
pnpm --filter @gym/api db:generate
pnpm --filter @gym/api db:migrate:deploy
pnpm --filter @gym/api db:seed
pnpm dev
```

Open Web at http://localhost:3000; the API listens on http://localhost:3001.
Expo Metro uses its own default port (usually 8081).

Customize the **local** password in both copied `.env` files *before* running the services.
Do not commit either file. The password in the example is for localhost-only development,
not for public networks or production.

**Note:** The init script creates `gym_app_test` for future local e2e runs
only when a new PostgreSQL data volume is first initialized.
It does **not** apply test migrations or run test seeds automatically.

## Commands

- `pnpm db:up` — start both services and wait for healthy status
- `pnpm db:ps` — inspect containers
- `pnpm db:logs` — follow service logs
- `pnpm db:down` — stop containers while retaining data volumes
- `pnpm dev` — start all three apps using Turborepo
- `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:mobile` — start separately

## Safety

Docker ports are bound to **127.0.0.1 only**, not all interfaces.
PostgreSQL and Redis data persist in named volumes.
There is **no** root script that destroys volumes or resets databases.
The example URLs are local-only; they must never be used for a public deployment.

If port 5432 or 6379 is already in use, modify the mapped port in
`infra/docker/.env`, and also update the corresponding API URL(s).

On Windows, start Docker Desktop with the Linux container backend
before using these commands. The initialization shell script must use LF endings.
