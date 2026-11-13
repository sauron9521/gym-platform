# Monorepo API quality gates — migration PR #15

The standalone gym-api-nestjs API had architecture, dependency, unit coverage,
and vulnerability guards beyond ordinary lint/typecheck/E2E. This change
restores those gates in the pnpm/Turborepo monorepo without altering API
runtime behavior or releasing production images.

## Feature architecture

The original audited checkers and their fixture tests live in
apps/api/scripts/. Their CLI working directory is apps/api, not the
monorepo root. They use the TypeScript AST, reject computed dynamic
imports, and enforce native ESM import paths, controller registration,
feature-layer structure and explicit cross-feature dependencies.

From the monorepo root:

    pnpm --filter @gym/api architecture:check
    pnpm --filter @gym/api architecture:deps
    pnpm --filter @gym/api test:architecture

## Coverage

Existing minimum global and critical-module thresholds are configured in
apps/api/vitest.config.ts. The separate API Coverage CI job runs
test:cov; failure to meet the minimum fails the job. It also summarizes
all measured source and auth, workouts and training-programs coverage,
and inventories production files not instrumented by the unit suite.

    pnpm --filter @gym/api test:cov
    pnpm --filter @gym/api coverage:summary
    pnpm --filter @gym/api coverage:inventory

The summary and inventory are distinct: absence from unit instrumentation
does not mean 0% line coverage. Integration/E2E checks remain separate.
CI uploads apps/api/coverage as a downloadable build artifact, with no
coverage files committed to Git.

## Dependency security

The dependency audit uses the single pnpm-lock.yaml from the monorepo root,
not the standalone API npm lockfile:

    pnpm audit --prod --audit-level high
    pnpm audit --audit-level critical

The checks block known high/critical production vulnerabilities and known
critical vulnerabilities anywhere in the workspace. Registry connectivity
and audit server availability may cause this gate to fail closed.

## Other safeguards

- Existing quality, Docker and PostgreSQL e2e jobs remain required.
- Main-branch CI is no longer canceled by a subsequent push. PR concurrency
  still cancels superseded runs.
- Infrastructure/release/monitoring scripts from the old repository will be
  migrated separately; this PR adds no automatic deployment.
