# OVRANTO — full-stack deployment plan

Status: proposed implementation sequence; no deployment authorization.
Baseline: [fac9b7a](https://github.com/sauron9521/gym-platform/commit/fac9b7a9c2b360b70b321d4bf99073f7410e81bb).
Authority: [S06](../product-strategy/s06-production-reliability-v1.md), [platform audit](../audits/ovranto-platform-audit-2026-11-27.md), #393, #323, #351, #352. Beta remains NO_GO.

The original inventory below is historical. See the [DEP11 readiness review](full-stack-deployment-readiness-2026-11-28.md) for the 2026-11-28 implementation reconciliation and outstanding acceptance evidence.

## Existing foundation

API runtime and migration Docker images, opt-in API-only Compose, digest override,
signed release artifacts, GHCR publication and staging/rollback workflows already
exist. API is published on host loopback; avatars use a named volume. PostgreSQL,
Redis and SMTP are configured dependencies. Four Next.js applications lack tracked
Dockerfiles and standalone output configuration. Preserve existing API tooling.

Web, Trainer and Admin use fixed server-only GYM_API_INTERNAL_URL rewrites for
same-origin /backend requests. Production requires explicit configuration.
Next rewrites can be compiled into build artifacts; runtime env changes alone
must not be assumed to change their destination. Landing uses LANDING_SITE_URL,
locale routing and optional public analytics. Mobile has its own native release
lifecycle and EXPO_PUBLIC_API_URL.

## Proposed topology and approved production host map

Start with one containerized VPS per environment, scale vertically first, prefer
managed PostgreSQL subject to cost and recovery objectives. Separate staging
infrastructure is preferred. Caddy is a proposed reverse proxy, Cloudflare the
DNS/edge candidate. Provider, region, capacity, proxy, budget and staging DNS
remain separate owner decisions.

| Host (#393)       | Container | Boundary                               |
| ----------------- | --------- | -------------------------------------- |
| ovranto.com       | landing   | Public marketing                       |
| app.ovranto.com   | web       | Same-origin backend                    |
| coach.ovranto.com | trainer   | Same-origin backend                    |
| admin.ovranto.com | admin     | Privileged session realm               |
| api.ovranto.com   | api       | Intended public API and native clients |

Only the edge receives public HTTP(S). Use private container networks and fixed
service aliases; a host proxy can use loopback ports. No public DB, Redis,
metrics, migration, backup or Docker socket. One modular monolith and one logical
database per environment, not per product. Keep single API replica and avatar
volume until #921/#923 demonstrate safe shared storage and distributed maintenance.
Migration is an explicit one-shot operator job; no automatic reset or seed.
No separate worker or new queue platform without measured need and review.

Proposed staging names: staging.ovranto.com, app-staging.ovranto.com,
coach-staging.ovranto.com, admin-staging.ovranto.com, api-staging.ovranto.com.
These are not approved DNS records. Isolate project, network, database, Redis,
storage, issuer, signing secrets, SMTP allowlist, native identity and evidence.
Use synthetic accounts; never production user data or credentials.
Cloudflare must verify origin TLS (no Flexible mode); validate proxy trust,
cert renewal, hostname allowlist and independent expiry alerts.

## Image and environment contracts

- Pilot Next standalone output in Landing, including monorepo tracing root,
  workspace dependencies, public/static assets, locales, writable runtime
  paths and actual container startup. Do not assume tracing completeness.
- Reuse frozen pnpm lockfile, pinned Node base digest, package manager version
  and Turbo graph. Separate build/runtime, non-root runtime, narrow context,
  bounded resources/logging, graceful stop and verified health. No secrets
  in build args, image layers, client bundles or logs.
- Candidate internal API alias http://api:3000 is identical in isolated
  environments. Verify effective compiled rewrite and absence of cross-env
  routes. For environment-bound build inputs, record distinct immutable
  artifacts and verify each; never silently rebuild a promoted image.
- Inventory Landing canonical/sitemap/robots and analytics build/runtime
  inputs. Keep staging noindex, no production analytics or unverified CTAs.
- Extend Compose to pass ADMIN_APP_URL and TRAINER_APP_URL when required.
  Validate APP_URL, CORS_ORIGINS, JWT issuer and TRUSTED_PROXY_CIDRS against
  current API schema. No wildcard CORS, shared parent-domain cookies or
  untrusted forwarded headers. Test cookie/CSRF, admin isolation, redirects,
  API permissions, no-store and email recovery URLs through actual proxy.
- Reuse [SMTP staging controls](cloudflare-smtp.md). Preserve notification
  feature flags and native release gates; no worker/reminder activation.

## Delivery sequence

One bounded PR at a time, latest main, relevant green CI, manual owner merge.
No new competing epic or milestone. No live deployment in implementation PRs.

| Slice | Existing ownership        | Scope and acceptance                                                                                       |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| DEP01 | #393 / #351               | Plan and inventory; owner review                                                                           |
| DEP02 | #393                      | Landing image pilot; standalone trace, static assets, locales, SEO, non-root, health/smoke                 |
| DEP03 | #393                      | Athlete Web image; fixed upstream, compiled rewrite, session and CSRF smoke                                |
| DEP04 | #393 / #369               | Trainer image; scope, capability and navigation smoke                                                      |
| DEP05 | #393 / #290               | Admin image; cookie isolation, permission and MFA regressions                                              |
| DEP06 | #393 / #351               | Full-stack Compose, isolated disposable rehearsal; existing API digest/migration contracts                 |
| DEP07 | #393                      | Proxy, host allowlist, TLS/env template and offline validation; no DNS mutation                            |
| DEP08 | #323 / #351               | Expand signed GHCR chain to web images; full manifest, verification and tamper rejection                   |
| DEP09 | #351                      | Real isolated HTTPS staging, exact digests, native connectivity, SMTP, Redis failure and critical journeys |
| DEP10 | #351 / #921 / #922 / #923 | Restore/rollback, connection budget, alerts and measured load; replica evidence separately                 |
| DEP11 | #352                      | Independent legal/security/reliability/release review and owner GO                                         |

DEP02–05 share a pattern but remain separate PRs. DEP08 preserves API-only
compatibility and manual publishing; manifest maps source SHA, platform,
component, digest and provenance. Require exact-commit CI, SBOM/scanning and
immutable staging evidence. Never deploy mutable latest tags.

## Rollout and recovery

Build once where environment independence is proven; verify artifacts, stage,
run compatible forward migration on isolated DB and verify critical journeys.
Production promotion requires separate explicit owner approval, verified backup,
migration compatibility and previous release digests. Runtime rollback only
when schema-compatible; otherwise stop writes and follow approved recovery
or forward fix. Never automatically reverse-migrate production.
Encrypted off-host DB and private media backups, actual restore, RPO at most
one hour / RTO at most four hours objectives and independent alerts remain
as defined in [Beta gates](../beta-readiness-gates.md).

## Limitations

Static source/issue review only. No provider selection, DNS/TLS verification,
container build, live smoke, provider pricing, secret changes or deployment.
Existing M02/M05/M07 and master #353 remain canonical. All original acceptance
criteria and NO_GO decisions remain unchanged.
