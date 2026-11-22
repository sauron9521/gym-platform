# Gym Platform documentation

This index groups developer-facing API documentation and operational runbooks. Production deployment is **not** enabled by these guides; migration cutover remains NO-GO.

## Product strategy and business decisions

- [Owner-approved product strategy index](product-strategy/README.md) — S01–S05 v1.0 recorded, plus S06 v1.0 owner-approved Production & Reliability policy (pending manual documentation PR merge); S07–S12 not started
- [Business governance](business-governance/README.md) — staff roles, approvals and operating policies

## Application development

- [ADR-005: product ownership and Trainer Web migration](architecture/adr-005-product-ownership-trainer-migration.md) — M05 app boundaries, route inventory, migration order and security gates

- [NestJS API handbook](api/README.md) — module map, contracts, validation, local testing
- [API test strategy](api/testing.md) — unit, HTTP e2e and PostgreSQL integration suites
- [API README](../apps/api/README.md) — local setup, migration baseline and database commands
- [Next.js Web handbook](../apps/web/README.md) — implemented routes, authentication, workouts, exercises and browser E2E
- [Generated API client](../packages/api-client/README.md) — OpenAPI-to-TypeScript generation
- [Docker local development](../infra/docker/README.md)

## Migration and quality

- [Migration audit and cutover gates](api-migration-audit.md)
- [Migration quality gates](migration-quality-gates.md)

## Releases and staging

- [Signed release and GHCR](release-ghcr.md)
- [Single-release staging rehearsal](staging-ghcr-monorepo.md)
- [Two-release upgrade/rollback rehearsal](staging-two-release-rollback.md)

## Production preparation (read-only/operator-driven)

- [Production readiness review](production-readiness-review.md)
- [Immutable digest preflight](production-digest-preflight.md)
- [Production host preflight](production-host-preflight.md)
- [Backup/restore operations](backup-restore-operations.md)
- [Observability](production-observability.md)

Operational documents retain their existing locations until the reference updates are made and tested in a separate change.

- [Fresh Prisma database baseline and reset policy](database-baseline-reset.md)
