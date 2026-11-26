# ADR-010 — Segregated API interfaces inside the modular monolith

- **Status:** Accepted target direction by the owner, 2026-11-26; Users and Auth migrations merged; [Users pilot review](adr-010-users-pilot-review.md) and [Auth migration review](adr-010-auth-migration-review.md) record evidence. ABI06 limited expansion recommended pending review.
- **Scope:** [Epic #909](https://github.com/sauron9521/gym-platform/issues/909), E14 [#354](https://github.com/sauron9521/gym-platform/issues/354).
- **Baseline:** [main 61401e69](https://github.com/sauron9521/gym-platform/commit/61401e69e2ef4b21e4ffc63adecf66c105402427); initial composition and file inventory, not a complete route/security audit.
- **Related:** [ADR-005](adr-005-product-ownership-trainer-migration.md), [ADR-007](adr-007-pragmatic-clean-architecture.md), [master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353), [architecture roadmap #380](https://github.com/sauron9521/gym-platform/issues/380).

## Context and decision

The backend currently has one NestJS bootstrap and AppModule. UsersModule registers both ordinary and administrative controllers; AuthModule contains ordinary and privileged session/MFA providers; trainer-specific controllers live in their owning feature modules. Admin functionality will grow, but endpoint count alone does not justify a second deployment.

Keep one `apps/api` process, one PostgreSQL/Prisma data model, shared identity and domain-first feature ownership. Separate HTTP interfaces and Nest composition by audience where contracts or authorization differ. A shared interface owns genuinely common authenticated endpoints used by Athlete and Trainer; do not duplicate controllers or routes solely because a second frontend uses them.

Use ADR-007 for internal operation boundaries. This decision incrementally changes presentation placement, not the approved domain/application/infrastructure dependency direction. Simple CRUD and existing unmigrated slices may retain their current structure until selected.

## Target layout

Illustrative structure, not a requirement to create empty directories:

```text
apps/api/src/
  api/
    public/          # unauthenticated product endpoints
    shared/          # common authenticated contracts
    athlete/         # athlete-specific HTTP adapters
    trainer/         # trainer-specific HTTP adapters
    admin/           # privileged HTTP adapters and composition
      users/
      auth/
      admin-api.module.ts
  modules/
    users/           # business module, exported application contracts
    auth/
    workouts/
    training-programs/
    trainer-athletes/
  common/            # cross-cutting technical policies and helpers
  infra/             # database, OpenAPI, health, external adapters
  app.module.ts
  main.ts
```

Only create an audience module when it owns actual routes. Health and metrics remain operational interfaces with their current access policy; they are not automatically public product routes. Existing routes need not match folder names. Existing role/capability semantics, including trainers acting as athletes, remain unchanged.

### Incremental controller ownership convention

For a feature moving HTTP adapters, declare the participating audiences in
`modules/<feature>/api-interfaces.json`, for example
`{"audiences":["admin","shared"]}`. Add the declaration only with real migrated controllers.
Use `api/<audience>/<feature>/controllers/`, a local
`<audience>-<feature>-api.module.ts`, and matching
`test/controllers/` unit and registry specs. During partial migration, the
legacy feature retains all its existing registration and test obligations.
A controller-free feature must explicitly register `controllers: []` and have
a nonempty, valid audience declaration backed by actual audience controllers.

The existing architecture checker validates these conventions and explicit
controller registrations. Static checks do not prove runtime route parity,
Nest dependency injection or reachability from AppModule; the pilot must prove
those separately.

## Ownership and dependencies

- HTTP adapters own route declarations, transport validation, request actor extraction, guards and response/error mapping. Audience composition modules import only the required business capabilities and transport helpers.
- Business modules own use cases, actor-aware policies, repositories, transactional invariants and data projections. Export narrow services/use cases or explicit DI tokens, never unrestricted repositories or Prisma clients. Cross-feature calls use existing public contracts.
- Core modules do not import audience modules or HTTP controllers. An audience module does not depend on another audience module; common routes are registered exactly once through shared composition. Avoid circular DI dependencies and broad re-export barrels.
- A controller-free business module is the extraction target for migrated features. Separate HTTP registration from provider registration; importing a business module must not accidentally register privileged or unrelated controllers. Keep provider instance ownership explicit and do not duplicate schedulers or cleanup tasks.
- Administrative queries may use purpose-built bounded projections owned by the relevant feature; cross-feature reporting may orchestrate authorized public read contracts. Do not bypass privacy, actor scope, transaction or audit policies through direct Prisma access from the API layer.
- Reuse existing dependency-cruiser and API architecture tests. Extend coverage for new paths before moving controllers; do not weaken rules or introduce a parallel checker merely to permit migration.

## Security and compatibility

Keep existing method/path pairs, status/error/body contracts, OpenAPI schema and generated client, validation, cookies, session purpose, authentication, MFA/step-up, RBAC, permissions, throttling, origin/CSRF and audit behavior. No automatic URL prefix or version migration. The backend must authorize each operation independently of frontend, hostname or route group.

Admin access remains default-deny with explicit privileged session and permission checks; preserve operation-specific MFA and revocation rules. Verify negative tests for ordinary sessions on privileged endpoints, wrong role/permission, expired or revoked sessions, missing MFA where required and unauthorized resource access. Preserve transactional audit and account status/revocation semantics. Separate folders alone are not a security boundary.

Maintain the canonical OpenAPI artifact and generated client. Audience-specific documentation may be derived later without breaking consumers or exposing internal operations publicly. Existing CI, real database integration, E2E and security gates remain mandatory where affected.

## Alternatives and extraction criteria

A second NestJS application with shared domain code and database would provide process-level deployment/isolation, but introduce duplicated bootstrap/configuration, database access and migration coordination, monitoring and release complexity. It would not by itself constitute an autonomous microservice. Independent domain services introduce additional network, data ownership and consistency costs.

Reassess a separate Admin API only with measured operational or release coupling, independent scaling demand, or a documented isolation requirement and explicit owner approval. Design distinct credentials, network access, session/audience policy, migration ownership, job ownership, deployment and rollback before extraction; shared database access alone is not isolation. Separate worker, queue, new package, ORM, database and microservices are not approved by this ADR.

## Incremental delivery and acceptance

1. ABI01 — record this ADR and register, clarify presentation placement in ADR-007.
2. ABI02 — [baseline inventory](adr-010-api-boundary-inventory.md): inventory actual controllers and methods, audiences, security policies, module/provider graphs, OpenAPI and regression coverage; reconcile parallel changes.
3. ABI03 — add minimal composition and enforce boundaries through existing architecture checks.
4. ABI04 — pilot Users/Admin Users separation without route or behavior changes; verify DI, OpenAPI parity, authorization and regression suites; [pilot review](adr-010-users-pilot-review.md) before expansion.
5. ABI05 — [Auth boundary inventory](adr-010-auth-boundary-inventory.md); Auth/Admin Auth only after session/MFA and dependency review, with dedicated security regression coverage; [ABI05e review](adr-010-auth-migration-review.md) before expansion.
6. ABI06 — remaining interfaces by small feature slice; keep shared routes single-owned. Start with [Trainer Onboarding boundary inventory](adr-010-trainer-onboarding-boundary-inventory.md) and [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md); continue with the refreshed ABI06b slices and [ABI06b cumulative review](adr-010-abi06b-migration-review.md) before TrainerAthletes; [ABI06c cumulative review](adr-010-abi06c-migration-review.md) records the completed relationship/dashboard transport migration and proposed Exercises sequence.
7. ABI07 — simplify composition and evaluate audience OpenAPI views without changing canonical contracts.
8. ABI08 — reconcile docs and evidence, verify architecture guardrails and document future extraction gates.

Every PR is based on current main, independently reviewable and manually merged after checks. No stage is complete without merged evidence; no production or Beta authorization is implied. Changes to public contracts or security behavior require separate review.
