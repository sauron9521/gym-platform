# API production Docker baseline — PR #14

This is an opt-in packaging and Compose baseline, NOT a production rollout.
Until release parity, backup/restore, staging and operational approval are
completed, the standalone gym-api-nestjs repository remains the source of
truth. The main monorepo production Compose file does not create or migrate
a live database automatically.

## Images

The build context is the monorepo root; Dockerfile lives in apps/api.
Node 24 uses Debian trixie in both the build and runtime stages, preserving
native dependency compatibility. pnpm is pinned to the workspace version
12.18.0. The Dockerfile has four key stages:

- build: frozen workspace install, Prisma 7 code generation, NestJS build and
  HTML mail assets.
- migrate: non-root one-shot image containing Prisma CLI, all schemas and
  SQL migration history. Never started by the regular API service.
- production-deps: pnpm deploy --prod creates an independent API-only
  production node_modules tree.
- runtime: non-root image, compiled dist and production dependencies, no
  Prisma CLI, with readiness healthcheck on port 3000.

The root .dockerignore excludes all local environment files, tokens, local
volumes and generated host artifacts. Review it before placing new secrets
inside the repository.

## Safe image build (no API deployment)

From the monorepo root, with Docker Engine available:

    docker build -f apps/api/Dockerfile --target runtime -t gym-platform-api:runtime-local .
    docker build -f apps/api/Dockerfile --target migrate -t gym-platform-api:migrate-local .
    docker run --rm --entrypoint node gym-platform-api:runtime-local --version

GitHub CI builds and inspects both image targets. It NEVER runs the
migration or starts production Compose.

The optional Compose config is infra/docker/compose.prod.yaml, separate
from the development Compose. A configuration validation only, using a
private dummy env file with DATABASE_URL, JWT_SECRET, JWT_ISSUER, APP_URL,
CORS_ORIGINS, SMTP_URL and MAIL_FROM, can be run with:

    docker compose --env-file /path/to/test-values.env -f infra/docker/compose.prod.yaml config --quiet

All supplied URLs must be safe placeholders during validation; do not put
real secrets into CI. The production Compose deliberately provides no
database or Redis instance. Its API port binds to 127.0.0.1:3001 by default.
Real user traffic needs an HTTPS reverse proxy, and PostgreSQL, Redis and
SMTP must be operated separately.

## Production prerequisites (not implemented here)

1. Provision secrets from a secure manager and confirm the API startup
   environment rejects invalid credentials, SMTP or HTTPS configuration.
2. Verify TLS termination, trusted proxy addresses, HttpOnly session-cookie
   flags, same-origin web proxy and CSRF on staging.
3. Create and verify encrypted off-host PostgreSQL AND avatar-volume backups;
   rehearse a restore and write down the rollback plan.
4. Have a reviewer explicitly approve any one-shot Prisma migration before
   replacing an API image. Never run db:seed or db:reset in production.
5. Run a full staging rehearsal including readiness, logs, SIGTERM shutdown,
   smoke requests, email delivery, rate limiting and recovery.
6. Introduce approved digest-pinned GHCR images, release signing, monitoring
   and operator-only deployment in later PRs.

The runtime uses a read-only root filesystem, no extra capabilities,
no-new-privileges, a small /tmp tmpfs, bounded resources and local Docker
logs. It writes avatars only to a persistent named volume; that baseline
supports one replica, not shared multi-replica uploads. Unhealthy containers
are NOT automatically restarted by Docker restart policy unless they exit.
