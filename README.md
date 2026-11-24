# Gym Platform

OVRANTO (Gym Platform) is a fitness platform monorepo powered by pnpm Workspaces and Turborepo. Athlete and Trainer products share one account identity and NestJS API; Admin access is independently protected. Product implementation and production approval are separate milestones.

## Repository layout

- `apps/` — NestJS API, Athlete Web, Trainer Web, Admin, Landing and Expo Mobile.
- `packages/` — shared libraries, types, and generated API clients.
- `tooling/` — shared development configuration.
- `infra/` and `ops/` — Docker, deployment and operator infrastructure.
- `scripts/` — repository tooling and operational contracts.
- `docs/` — [technical documentation, decisions and runbooks](docs/README.md).

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

## Applications and local development

| Workspace                             | Purpose                                           | Start command      | Default local address     |
| ------------------------------------- | ------------------------------------------------- | ------------------ | ------------------------- |
| [API](apps/api/README.md)             | NestJS backend                                    | `pnpm dev:api`     | http://localhost:3001     |
| [Athlete Web](apps/web/README.md)     | Athlete experience                                | `pnpm dev:web`     | http://localhost:3000     |
| [Landing](apps/landing/README.md)     | Public product site                               | `pnpm dev:landing` | http://localhost:3002     |
| [Admin](apps/admin/README.md)         | Protected operator console with dedicated sign-in | `pnpm dev:admin`   | http://localhost:3003     |
| [Trainer Web](apps/trainer/README.md) | Protected trainer workspace                       | `pnpm dev:trainer` | http://localhost:3004     |
| [Mobile](apps/mobile/README.md)       | Expo iOS/Android and web development              | `pnpm dev:mobile`  | Metro (usually port 8081) |

Docker Compose v2 runs PostgreSQL 17, Redis 8 and Mailpit locally; all six applications run on the host. Mailpit's inbox defaults to http://localhost:8025.

Follow the [local development setup](infra/docker/README.md) for Linux/macOS and Windows, environment configuration, database safety and starting applications. After setup, use `pnpm dev` to start all application dev tasks or the individual commands above. Existing port conflicts must be resolved before starting the relevant application.

## Fresh database migration baseline

On 14 November 2026, the pre-production Prisma history was consolidated into a frozen initial baseline. Subsequent schema changes use forward-only migrations. Apply the complete active chain to a fresh database or pending migrations to a compatible database. Legacy pre-reset databases require a separately reviewed plan; never reset a non-disposable database. See [migration history and baseline policy](docs/database-baseline-reset.md). No production database is modified automatically.

## Test runner and CI

Unit and contract tests use **Vitest 5** across API, Web, Landing, Admin,
Trainer, Mobile, shared packages and root tooling. Web, Admin and Landing browser E2E remain
on Playwright; Mobile uses Vitest Native + React Native Testing Library for
component tests, with Maestro reserved for device-level E2E.

```bash
pnpm test:tooling                         # Repository CI, release and ops contracts
pnpm --filter @gym/api test              # Nest unit tests
pnpm --filter @gym/api test:architecture # Architecture contracts
pnpm --filter @gym/mobile test           # Mobile Node contracts + native components
pnpm --filter @gym/web test              # Web contracts
pnpm test                                # Turborepo workspace tests
```

Shared Node test defaults live in `tooling/vitest/node.mjs`. Their individual
Vitest configs scope test discovery to each workspace. CI runs root tooling
contracts **once** in the required `Tooling contracts / Vitest Node 24` job,
while retaining specialized integration, Docker, Windows, database and browser
gates. See [testing conventions](docs/development/testing.md).

## Contribution workflow

Open a pull request against `main`. CI verifies formatting and workspace quality tasks.
Only the repository owner merges approved changes.

## Typed API contract

Athlete Web, Trainer Web, Admin and Mobile depend on `@gym/api-client` in `packages/api-client`. Landing does not consume the generated client.
Types are generated from the NestJS OpenAPI schema and checked in CI.

After changing API routes or DTOs, run `pnpm api:contract:generate` and commit
the updated `apps/api/openapi/openapi.json` and `packages/api-client/src/generated/schema.d.ts`
alongside the API change. See [client documentation](packages/api-client/README.md).

## Manual API release pipeline

Production API Docker images may be packaged and signed by the manual
`release-artifacts.yml` workflow, then independently verified before an
explicit GHCR publication in `publish-ghcr.yml`. Neither workflow deploys
to production or runs database migrations.
See [release and GHCR procedures](docs/operations/release-ghcr.md).

## API backup and recovery toolkit

The monorepo includes opt-in PostgreSQL/avatar backup, guarded restore rehearsal,
and backup-health alert templates. These are not enabled on merge and require
operator-controlled credentials, storage and independent off-host replication.
See [backup, restore and monitoring](docs/operations/backup-restore-operations.md).

## Opt-in API observability

The API includes optional host collectors for sanitized HTTP/Redis logs,
Docker container resources, readiness and provisional Prometheus SLI views.
These do not start automatically. See [observability operator guide](docs/operations/production-observability.md)
for host privileges, environment templates, alerts and manual activation.

## API source migration audit and cutover

The imported API has a frozen legacy source/test inventory and a CI-backed,
read-only cutover audit. **Production remains NO-GO** until signed GHCR images,
staging, two-release rollback and external operator approvals are verified.
See [API migration audit and cutover criteria](docs/api-migration-audit.md).

## Signed two-release API rollback rehearsal

Manual, runner-only [two-release upgrade and rollback](docs/operations/staging-two-release-rollback.md)
checks signed GHCR runtime compatibility after forward Prisma migrations.
Repository CI validates safety contracts only; production cutover stays NO-GO.

## Independent production release-evidence review

Manual, read-only [release readiness review](docs/operations/production-readiness-review.md)
checks exact signed GHCR digest publication, main source CI and successful
seven-stage two-release rehearsal. Even when evidence is verified, the
review reports **production NO-GO**; it never deploys or replaces the
standalone API without separately approved host operations.

## Immutable production digest preflight (read-only)

The [digest-only Compose policy](docs/operations/production-digest-preflight.md) adds
strict offline checks for signed GHCR image references, build-free Docker
Compose overrides and the existing runtime identity. The checks **never
start or update production services**. A separate operator-approved
release rollout and real staging evidence are still required.

## Operator-only production host preflight

The [read-only host preflight](docs/operations/production-host-preflight.md) verifies
trusted signed GHCR images, exact deployed image identity, private backup
archive hashes and the original GitHub Actions release-evidence artifact
for an explicitly supplied successful review run ID. It never runs a migration,
starts a container or authorizes production; human restore and operational
approval remain required.

## API developer handbook

See [module-by-module API documentation](docs/api/README.md), the [API testing guide](docs/api/testing.md), the [Web app guide](apps/web/README.md) and the [documentation index](docs/README.md).
