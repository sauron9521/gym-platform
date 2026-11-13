# Gym Platform documentation

This index groups developer-facing API documentation and operational runbooks. Production deployment is **not** enabled by these guides; migration cutover remains NO-GO.

## Application development

- [NestJS API handbook](api/README.md) — module map, contracts, validation, local testing
- [API test strategy](api/testing.md) — unit, HTTP e2e and PostgreSQL integration suites
- [API README](../apps/api/README.md) — local setup and database commands
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
