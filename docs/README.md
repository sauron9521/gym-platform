# Gym Platform documentation

This index groups developer-facing API documentation and operational runbooks. Production deployment is **not** enabled by these guides; migration cutover remains NO-GO.

## Product strategy and business decisions

- [Owner-approved product strategy index](product-strategy/README.md) — **S01–S12 APPROVED + RECORDED** in `main`; strategy publication is not implementation, Beta, paid, health, AI or Marketplace GO
- [Business governance](business-governance/README.md) — staff roles, approvals and operating policies
- [Post-S12 implementation baseline audit](post-s12-implementation-audit.md) — evidence-based snapshot, Beta blockers, milestone assignment and proposed small-PR delivery order; **OWNER REVIEW**, not Beta/production GO
- [Closed Beta GO/NO-GO evidence matrix](beta-readiness-gates.md) — release-specific mandatory evidence, quantitative targets and explicit owner decision; **NO_GO** until independently verified

## Application development

- [ADR-005: product ownership and Trainer Web migration](architecture/adr-005-product-ownership-trainer-migration.md) — M05 app boundaries, route inventory, migration order and security gates
- [ADR-006: shared package ownership and runtime boundaries](architecture/adr-006-shared-package-boundaries.md) — package consumer matrix, dependency rules, import verification and follow-up ownership
- [ADR-007: Pragmatic Clean Architecture for the API](architecture/adr-007-pragmatic-clean-architecture.md) — incremental business-rule isolation, publication pilot, guardrails and owner review gates

- [NestJS API handbook](api/README.md) — module map, contracts, validation, local testing
- [API test strategy](api/testing.md) — unit, HTTP e2e and PostgreSQL integration suites
- [API README](../apps/api/README.md) — local setup, migration baseline and database commands
- [Athlete Web](../apps/web/README.md) — routes, authentication, workouts, exercises and browser E2E
- [Trainer Web](../apps/trainer/README.md) — protected trainer workspace and client read models
- [Admin](../apps/admin/README.md) — dedicated operator sign-in and account directory
- [Mobile](../apps/mobile/README.md) — Expo development, native authentication and testing
- [Landing](../apps/landing/README.md) — public product site
- [Repository overview and local application ports](../README.md#applications-and-local-development)
- [Generated API client](../packages/api-client/README.md) — OpenAPI-to-TypeScript generation
- [Local development setup (Linux/macOS and Windows)](../infra/docker/README.md)

## Migration and quality

- [Custom script replacement audit](custom-scripts-replacement-audit.md) — complete top-level scripts inventory, safe tool alternatives and one-PR migration order

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
