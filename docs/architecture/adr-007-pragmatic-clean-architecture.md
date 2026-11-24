# ADR-007 — Pragmatic Clean Architecture for the API

- **Status:** Accepted target direction (owner decision 2026-11-24); ADR merged in PR #729; implementation in progress.
- **Scope:** API modular monolith; [Epic #718](https://github.com/sauron9521/gym-platform/issues/718), [CA01 #719](https://github.com/sauron9521/gym-platform/issues/719).
- **Baseline:** [main 4407a2c](https://github.com/sauron9521/gym-platform/commit/4407a2cdeaddaa158c538a06cb584cd67753074d); file and test inventory, not a measured coverage or performance result.
- **Roadmaps:** [master #353](https://github.com/sauron9521/gym-platform/issues/353), [architecture #380](https://github.com/sauron9521/gym-platform/issues/380), [E14 #354](https://github.com/sauron9521/gym-platform/issues/354).
- **Related decisions:** [ADR-005](adr-005-product-ownership-trainer-migration.md), [ADR-006](adr-006-shared-package-boundaries.md).

## Decision and non-goals

Keep one NestJS API, PostgreSQL/Prisma, the existing feature ownership and Turborepo workspace. Adopt inward dependencies **by complex business operation**, not by moving all files or requiring four folders per module. Favor pure rules, stable application contracts and narrow infrastructure adapters where they materially reduce coupling, testing cost or change risk.

Use the existing layered services/repositories for simple CRUD and read projections. Do not introduce a generic repository, universal Unit of Work, mandatory entities/value objects, CQRS bus, event sourcing, another ORM, microservices, GraphQL, Kafka or a new dependency merely to conform to the diagram. Frontend feature boundaries and generated API client remain unchanged. Existing product, security, staging and Beta gates retain precedence; this ADR is not release authorization.

## Layer responsibilities and dependency rules

| Boundary       | Owns                                                                               | Allowed dependencies                                   |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Domain         | Pure policies, invariants, domain errors and value types                           | Same domain; approved pure shared contracts            |
| Application    | Use cases, actor-aware orchestration, input/output types and ports                 | Domain and application-owned contracts                 |
| Infrastructure | Prisma queries, selects, mapping, transaction implementation and external adapters | Domain, application ports, infrastructure              |
| Presentation   | HTTP controllers, DTO/Zod transport validation, response/error mapping             | Application contracts; outer transport/runtime helpers |
| Composition    | Nest module wiring, provider tokens/factories                                      | All layers solely to assemble them                     |

Source dependencies point inward. Domain must not import NestJS, Prisma (including generated types), HTTP DTOs, environment configuration, other layers, or I/O adapters. Application code in migrated slices must not import Nest decorators, concrete repositories, Prisma types or transport exceptions; inject dependencies through plain TypeScript constructor parameters. Type-only imports follow the same boundaries. Do not hide prohibited imports behind barrels or aliases.

Ports live with the consuming application code, describe the needed business capability rather than ORM CRUD, and return application-owned shapes. Infrastructure implements those contracts. Nest module wiring may use a symbol token and an explicit factory provider to construct an undecorated use case. A TypeScript interface is not a runtime DI token. Keep tokens local to the composition boundary unless a genuine public contract requires export; verify actual Nest registration and resolution.

Use existing public feature APIs and explicit module exports for cross-feature calls. Never import another feature's private repository, select, policy or implementation to bypass ownership. Keep cross-feature runtime graphs acyclic and authorization with the owning feature. Do not use a new shared folder as a bypass.

## Incremental module layout

Illustrative target for the publication slice; not a directory migration in this ADR:

```text
training-programs/
  controllers/                         # existing HTTP entrypoints
  dto/                                 # existing transport schemas
  services/                            # legacy facade and unmigrated operations
  repositories/                        # existing persistence adapters
  selects/                             # Prisma projections
  domain/
    publication.policy.ts
    publication.errors.ts
  application/
    publish-program.use-case.ts
    ports/
      publish-program.port.ts
  test/
  training-programs.module.ts          # composition
```

Logical presentation/infrastructure layers need not be named directories. Keep controllers directly in the existing controllers directory and registered in the feature module, with their existing test registry. Preserve current naming and import conventions. Extend guardrails deliberately before introducing nested paths or new provider patterns; do not disable an existing check to allow a migration.

## Selecting migration slices

Prefer operations with multiple state transitions, access rules, concurrent writes or infrastructure dependencies (publication, workout completion, trainer relationship termination, future billing or delivery orchestration). Extract a domain policy only for a real invariant; introduce a use case or port when it improves an actual boundary or supports independent testing. A simple pass-through wrapper without a useful boundary is insufficient.

Read-side queries may keep Prisma projections in existing infrastructure/repository and read services outside migrated application code. Do not force domain entities or map an entire aggregate for a paginated read. Preserve bounded queries, projection privacy, Decimal precision and existing date/null serialization; never export generated Prisma types as new application contracts. No schema changes or generated client changes for a behavior-preserving migration.

## Errors and transaction ownership

Represent expected business failures with narrowly typed domain/application errors or outcomes. Use stable discriminants where helpful; do not parse error message strings as a public contract. Translate them at the outer boundary into exactly the current HTTP status, error code, message and response shape. Unknown failures retain existing diagnostic handling and must not leak database details. Do not change global error handling in the pilot unless separately reviewed.

Translate operation-specific known Prisma errors in the adapter only when their semantics are established; never translate every unique constraint or missing-record error into the same business failure. Preserve not-found versus forbidden behavior, actor identity, ownership, capability checks and scope predicates. Client preconditions are not authorization.

Application owns the business operation and its atomicity requirement. Infrastructure owns SQL, Prisma transaction clients, lock acquisition and database-specific error handling. For the publication pilot, prefer a narrow atomic persistence operation over splitting locked reads and writes across independently committed calls. Pass explicit identifiers and relevant actor scope through the boundary; retain all current service access checks and authoritative database constraints. Do not move authoritative validation outside the transaction. Keep existing lock order, isolation, conditional updates and rollback behavior. Do not introduce automatic retries or external side effects inside a transaction; coordinate future atomic event persistence with [Outbox #568](https://github.com/sauron9521/gym-platform/issues/568).

## Publication pilot: baseline and target

At the pinned baseline:

| File under `apps/api/src/modules/training-programs/`  | Observed coupling                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `policies/training-program-publication.policy.ts`     | Pure structural checks except Nest `BadRequestException`; called both before and inside the write transaction                                |
| `services/training-program-version.service.ts`        | Concrete repository and CRUD service; Nest HTTP exceptions; Prisma update input and known-error codes P2002/P2025 in other version scenarios |
| `repositories/training-program-version.repository.ts` | Prisma, SQL locks, policy invocation, exercise availability check, conditional publication and rollback                                      |
| `types/training-program-payload.types.ts`             | Prisma GetPayload types derived from selects                                                                                                 |
| `types/training-program-repository.types.ts`          | Prisma filter/order input types                                                                                                              |
| `training-programs.module.ts`                         | Nest composition with concrete providers                                                                                                     |

Before: controller/facade calls the version service; service checks program access, archive/draft state and publishability, then invokes the Prisma repository. The repository repeats publishability on locked data.

After (CA03/CA04 target): the same HTTP entrypoint and facade call an application publication use case; it uses pure policy and operation-specific ports. The concrete adapter implements atomic publication and calls the same pure policy on authoritative locked data. Outer mapping restores the existing HTTP contract. Legacy reads and other version operations remain unchanged until explicitly scoped.

Publication invariants to preserve:

- A non-empty program, at least one exercise per workout and one set per exercise; a workout week cannot exceed a specified duration.
- Only a draft may publish; an archived program cannot publish; retain current trainer access and version/program scoping.
- Lock the draft version row with FOR UPDATE, re-read after acquisition, then lock referenced exercises in ID order with FOR SHARE; preserve the existing relationship between publication and competing draft edits or exercise archival.
- Reject missing/archived/unavailable exercises, including another owner's private source; keep the current GLOBAL or owning TRAINER_CUSTOM source policy.
- Conditional version DRAFT-to-PUBLISHED update and non-archived parent update remain in one transaction; roll back the version change if the parent update fails. Preserve returned snapshot, timestamp semantics and conflict response.

The initial precheck may provide fast feedback, but cannot replace the locked recheck. A port returning a prechecked snapshot followed by an unrelated write does not satisfy the invariant.

## Guardrails and testing baseline

Reuse current scripts; [Dependency Cruiser integration](../dependency-cruiser-pilot.md) explains the workspace graph gate.

- `pnpm --filter @gym/api architecture:check`: existing structural/controller registration conventions.
- `pnpm --filter @gym/api architecture:deps`: feature import, Nest module and runtime/provider dependency checks.
- `pnpm --filter @gym/api test:architecture`: existing architecture/parser fixtures.
- `pnpm architecture:cruise:boundaries` and `pnpm test:tooling`: parsed graph and workspace/tooling contracts; existing declarative config is `.dependency-cruiser.cjs`.
- `pnpm format:check`: repository formatting.

CA02 extends the existing checks for migrated slices, including resolved aliases, type-only imports, forbidden outward edges and cycles. Test both allowed and forbidden fixtures; keep legacy exceptions explicit and non-growing. Current checks do not by themselves establish the new inward rules or guarantee support for every provider factory pattern.

Existing pilot regression inventory (test files inspected, not executed by this ADR):

- Unit: publication policy covers valid/invalid structural cases; version service covers archived/draft state, access denial, conflict and successful publication; version repository covers locked validation, missing sources, exercise locks and rollback behavior.
- HTTP: controller tests and `apps/api/test/e2e/training-programs/published-versions.e2e-spec.ts` are existing contract surfaces to retain; inventory further HTTP publication scenarios before CA03.
- PostgreSQL: `training-program-publication-integrity.integration.e2e-spec.ts` covers archived/private exercise rejection and archive-first concurrency; `training-program-version.repository.integration.e2e-spec.ts` covers archived parent rollback and successful publication.

For CA03/04, add pure Vitest policy cases without Nest/Prisma; use case unit tests with typed fakes; adapter tests against disposable real PostgreSQL for concurrent publish/draft edit, exercise archival, authorization, stale state and rollback. Preserve HTTP contract and generated OpenAPI/client compatibility, including failure payloads. Run required CI and relevant full API/integration suites; mocks alone are not proof of transaction safety.

### CA02 pilot enforcement

CA02 first enabled the `architecture:deps` AST guard for Training Programs. CA07 and CA08 added Workouts and Trainer–Athletes. Production `.ts` files under each opted-in feature's `domain/` and `application/` directories must resolve imports to the allowed inner layers of that feature. The domain may import its own domain, and application may also import its own application contracts. The guard checks type-only imports, re-exports, literal dynamic imports and the `#src/` alias. It rejects computed imports, computed require and file dependency cycles, including type-only and self edges.

No external package or shared contract is approved for this pilot; any needed pure shared dependency must be reviewed and explicitly enabled, not accessed through an outer barrel. Unresolved local targets fail closed. The guard checks direct static source dependencies, not arbitrary indirect runtime loading or malicious code. Actual Nest factory wiring remains subject to integration tests.

Legacy `services/`, `repositories/`, `policies/`, `types/`, `selects/`, `controllers/` and `dto/` paths, and other features, are not opted into the new inward-layer rule. Existing workspace/feature rules continue unchanged; there is no per-file bypass list. Expanding this scope requires a reviewed change to the explicit feature set. The new rules are exercised by existing `test:architecture` and `architecture:deps` CI steps; no additional checker or CI job is introduced.

### CA04 publication composition

The pilot uses the plain `PublishProgramUseCase<Result>` and operation-specific `PublishProgramPort<Result>`. The port carries actor and resource identifiers and exposes only two authorized reads and one atomic write. The factory in `publication.provider.ts` is registered with a symbol token in the existing Nest feature module; the existing version service delegates publication and maps typed conflicts/domain errors to the current HTTP exceptions. Both original live access checks remain in the adapter.

The result type is opaque to the use case: the composition boundary supplies the existing repository projection unchanged, preserving Decimal, dates and response shape without a second persistence model. The repository retains the original row locks, locked domain validation, source checks, conditional updates and rollback. Known publication failures become typed domain errors or the existing stale/null outcome; unrelated or unexpected Prisma errors retain the established global error mapping rather than being mislabeled as publication conflicts. Other version operations remain legacy. No new schema, packages or global filter changes.

## Shared domain ownership

[ADR-006](adr-006-shared-package-boundaries.md) and [domain package README](../../packages/domain/README.md) define `@gym/domain` as the framework-neutral home of existing workout transition/precondition and set-progress helpers. It is not a general shared server domain package. Keep publication rules API-local unless stable real cross-runtime consumers justify promotion. Reuse existing workout adoption issue [#329](https://github.com/sauron9521/gym-platform/issues/329); server access control, locking and writes remain authoritative.

## Rollout and acceptance

| Stage                     | Issue                                                                                                                                                                                       | Gate                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ADR and baseline          | [#719](https://github.com/sauron9521/gym-platform/issues/719)                                                                                                                               | Owner review and docs merge                              |
| Guardrails                | [#720](https://github.com/sauron9521/gym-platform/issues/720)                                                                                                                               | Tested inward rules before pilot                         |
| Pure policy/errors        | [#721](https://github.com/sauron9521/gym-platform/issues/721)                                                                                                                               | Exact error and locked invariant parity                  |
| Publication use case/port | [#722](https://github.com/sauron9521/gym-platform/issues/722)                                                                                                                               | Atomicity, access, contracts and required CI             |
| Pilot evaluation          | [#723](https://github.com/sauron9521/gym-platform/issues/723)                                                                                                                               | Explicit owner GO/no-go                                  |
| Selected expansion        | [#724](https://github.com/sauron9521/gym-platform/issues/724), [#725](https://github.com/sauron9521/gym-platform/issues/725), [#726](https://github.com/sauron9521/gym-platform/issues/726) | Only after GO; one operation per PR                      |
| Future-module adoption    | [#727](https://github.com/sauron9521/gym-platform/issues/727)                                                                                                                               | Evidence or explicit deferral and roadmap reconciliation |

Coordinate with [#650](https://github.com/sauron9521/gym-platform/issues/650) for exercise read boundaries, [#344](https://github.com/sauron9521/gym-platform/issues/344) for workout concurrency, [#563](https://github.com/sauron9521/gym-platform/issues/563) for notifications and [#711](https://github.com/sauron9521/gym-platform/issues/711) for tooling. Do not duplicate their feature work.

Each PR starts from current main, preserves behavior, is independently reviewable and has appropriate regression evidence. Never auto-merge. Do not close issues before verified acceptance. At CA05 compare actual dependency edges, abstraction/file count, test isolation and reproducible test duration, alongside access/transaction evidence. Stop or revise if the added complexity outweighs the benefit. No blanket migration or release approval is implied.

CA05 evidence and the explicit owner GO of 2026-11-24 are recorded in the [publication pilot evaluation](adr-007-pilot-evaluation.md). Limited expansion is approved under the stated safeguards; start CA06 only after the evaluation PR is manually merged and CA05 is verified. This is not release approval.

CA06 and CA07 are complete. See the [Training Programs evidence](adr-007-training-programs-expansion.md) and [Workouts evidence](adr-007-workouts-expansion.md) for the selected boundaries, PostgreSQL regressions and deferred work. CA07 enabled the existing inner-layer guard for Workouts and verified the `@gym/domain` native ESM runtime in the API Docker image before adopting shared workout rules.

CA08 applies the same guard to Trainer–Athletes. The [Trainer–Athletes evidence](adr-007-trainer-athletes-expansion.md) records the verified invitation and termination boundaries, PostgreSQL concurrency and rollback checks, and completion of [#726](https://github.com/sauron9521/gym-platform/issues/726).

The [CA09 adoption checklist](adr-007-future-module-adoption.md) applies the standard to individual operations in future feature issues and links the implementation evidence to the existing roadmaps.
