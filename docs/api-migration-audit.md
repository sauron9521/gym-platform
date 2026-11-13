# API migration audit and production cutover criteria

**Status: REPOSITORY IMPORT VERIFIED; PRODUCTION CUTOVER NO-GO.**

Monorepo snapshot: `sauron9521/gym-platform` at commit
`98d5be4cea9fd6c454536c0ab764d64a55ce7925`.
Operational legacy source: `sauron9521/gym-api-nestjs` at commit
`79e53bc1b7a78bb3856ff2aeab2529559240521e`.

The frozen audit inventory is `apps/api/migration-source-inventory.json`;
historical Prisma SQL history is checked against
`apps/api/migration-baseline.json`. Verify from repository root:

```sh
node --test apps/api/test/migration-baseline.test.mjs scripts/api-migration-readiness.test.mjs
node scripts/api-migration-readiness.mjs --report
```

The report checks local inventory and repository artifacts, explicitly
lists missing staging workflows, and always returns production NO-GO.
A green workflow never grants authorization to deploy.

## Imported source audit

| Legacy scope         | Original files | Identical Git blob SHA | Adapted blobs | Missing |
| -------------------- | -------------: | ---------------------: | ------------: | ------: |
| `src/`               |            302 |                     86 |           216 |       0 |
| `test/`              |             48 |                      2 |            46 |       0 |
| `prisma/schemas/`    |             10 |                     10 |             0 |       0 |
| `prisma/migrations/` |             25 |                     25 |             0 |       0 |

The comparison maps old paths to `apps/api/`. The snapshot records
original file Git blob hashes, distinguishes unchanged versus adapted
files and verifies each imported source/test path still exists.
Prisma schema and migration integrity is verified independently.

**Presence is not behavioral parity.** In particular 216 adapted source
files and 46 adapted test files differ from their old Git blobs, for
monorepo-related reasons such as ESM import paths, pnpm workspace
dependencies, test and generated Prisma configuration. These changes
must be exercised with authenticated functional and staging tests.

## Migrated foundations

The monorepo has core NestJS source/tests, frozen Prisma history,
PostgreSQL 17/Redis 7 e2e, OpenAPI contract and typed frontend client,
Node 24/pnpm Docker runtime and one-shot migration image, CI
architecture/coverage/security checks, manual signed release and GHCR
publisher workflows, backup/restore tooling, HTTP/Redis/Docker
observability with Prometheus rules and a Grafana dashboard.

The release workflows have **not** yet been demonstrated on a real
published signed release in this migration. Backup and monitoring
templates are opt-in, not running in production.

Not every old standalone artifact should be blindly copied. A number
of scripts and older runbooks still require disposition, including
advanced multi-instance HTTP SLO governance, historical retention
planning and independent alert receipt drills. Old systemd names were
deliberately replaced by Gym Platform equivalents.

## Blocking gaps

1. **Signed single-release staging:** the old
   `.github/workflows/staging-ghcr.yml` and its smoke tools are
   included in Gym Platform starting with PR #20, but a successful
   **manual run against newly published, attested Gym Platform digests**
   is still required. The offline CI contract checks alone are not
   staging evidence. Use disposable PostgreSQL/Redis and synthetic
   credentials.
2. **Two-release rollback:** `.github/workflows/staging-upgrade-rollback.yml`
   and its offline tests are now included, but a real **manual run using
   two separately published and verified Gym Platform releases** remains
   mandatory. Demonstrate that the old runtime remains functional after
   forward migrations and safe runtime-only rollback preserving data.
   See [two-release staging guide](staging-two-release-rollback.md).
3. **Independent production evidence review:** `.github/workflows/production-readiness.yml`
   and its offline contract tests are now included (PR #22). A **real
   manually triggered** read-only review must still verify the published
   signed digests, source commit's nine green CI jobs, successful
   two-release staging receipts and publisher signer identity. The
   review always returns **production NO-GO** until independent human
   host evidence and approval. See [release evidence review](production-readiness-review.md).
4. **Human approval:** secure off-host backup plus full database and
   avatar restore, TLS/proxy, session cookies and CSRF, secrets, SMTP,
   Redis failure handling, alert delivery, staff/on-call, authorized
   image digests and a concrete maintenance/rollback window are
   external operational prerequisites.

The preflight report deliberately lists workflows still missing and
never infers staging success from the presence of a workflow file. The
automated CI stays green when its audit correctly reports NO-GO;
production authorization is a separate process.

## Staging functional checklist

On isolated staging, exercise account registration, verification and
password recovery; credentials login, refresh, logout and session TTL;
profile and avatar I/O; global and private exercises; workouts and
completion; trainer/athlete relationships and termination; program
draft/publish/assign versions and authorization; unauthenticated and
cross-user denial; mail failures and redaction. Verify Next.js
same-origin proxy cookies, CSRF, redirects, JWT/session invalidation,
live/ready probes, 429/503 and Redis failover, SIGTERM, state persistence
and response compatibility with the old API. Compare actual HTTP
behavior with the generated OpenAPI client.

## Rehearsed cutover sequence

1. **Freeze and reconcile:** pick the final legacy commit; check for
   upstream fixes after the frozen import, and port necessary changes
   before cutover. Keep the old repo as operational source.
2. **Verify release identity:** require successful exact-source main CI.
   Run manual signed candidate, independent verification and GHCR
   publication. Deploy only immutable `ghcr.io/...@sha256:...` refs.
   Publisher signing SHA may differ from application source SHA.
3. **Rehearse:** run single-image and two-image staging upgrades.
   Verify backward-compatible database migrations, authenticating after
   upgrade and runtime-only rollback with persistent data.
4. **Protect real state:** create consistent-enough DB/avatar snapshot,
   encrypt, replicate off-host, and rehearse whole-system restore.
   The PostgreSQL dump and avatar tar are not atomic with each other;
   freeze avatar writes if a coordinated recovery point is required.
   Document actual RPO/RTO.
5. **Operate safely:** verify production HTTPS, trusted proxies, SMTP,
   cookie security, DB/Redis access, auth and throttling, private logs,
   node_exporter/Prometheus/Alertmanager, notification delivery and
   escalation on staging.
6. **Approve switch:** operator signs off on exact signed digests,
   health gates, backups, rollback steps, staffing, abort threshold
   and change window before routing traffic to the new API.
7. **Rollback safely:** use a previous signed _runtime_ only if it was
   staged against the newer schema. Never blindly reverse SQL migrations.
   If forward compatibility cannot be proven, stop and invoke the
   independently reviewed backup/restore recovery plan.
8. **Handover later:** keep standalone API operational until a
   documented observation period and explicit ownership transfer.
   Only then update deployment ownership, developer documentation,
   secrets, and consider archiving the old repository.

Store evidence and approvals outside the public Git repo. Raw logs,
DB backups, credentials and personal identifiers must not be put in
GitHub Actions artifacts. Staging workflow success is necessary but not
equivalent to real-production readiness.

**Decision: NO-GO.** This PR provides verifiable source provenance,
repository checks and operator cutover criteria. A separate focused PR
must port, exercise and validate the missing signed staging/rollback
workflows before a production handover is considered.

## Digest-only production Compose preflight (PR #23)

The [offline digest guard](production-digest-preflight.md) validates a
build-free override for both signed GHCR images, the original Compose
hardening and expected current runtime identity. No automatic deployment,
migration or host contact is added. Production cutover is still **NO-GO**
until real signed staging, off-host restore and human approval are proven.

## Operator-host read-only checks (PR #24)

The [operator-only host preflight](production-host-preflight.md) validates
real local backup archive hashes, a private release receipt, signed GHCR
attestations, cached Docker image identity and the existing API container
in the exact Compose project. It **does not perform a full restore** or
establish independently that a copied JSON receipt came from GitHub.
No production mutation or cutover is authorized. **NO-GO** remains.
