# Operations, release and staging runbooks

Canonical navigation for operator-controlled release evidence, staging, recovery and production diagnostics. All existing production NO-GO, independent verification and manual approval gates remain in force. These guides do not authorize deployment, run commands or grant access to live infrastructure.

## Full-stack deployment planning

- [Full-stack deployment plan](full-stack-deployment-plan.md) — proposed web containers, host routing, artifact promotion and staging sequence; no deployment authorization.
- [DEP11 readiness review (2026-11-28)](full-stack-deployment-readiness-2026-11-28.md) — merged implementation evidence, outstanding Beta gates and ordered operator decisions; NO_GO.
- [INF01 hosting decision](infrastructure-hosting-decision.md) — owner-approved Hetzner Germany, self-hosted PostgreSQL and EUR 50 monthly ceiling; no provisioning authorization.
- [INF02 OpenTofu foundation](../../infra/tofu/README.md) — inactive environment roots and isolated mock validation; no provisioning.

## Signed releases and staging

| Runbook                                                             | Scope                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Release and GHCR publication](release-ghcr.md)                     | Verified source commit, signed artifacts and immutable image publication                    |
| [Single-release staging rehearsal](staging-ghcr-monorepo.md)        | Disposable GitHub runner, signed runtime and migration images                               |
| [Two-release upgrade and rollback](staging-two-release-rollback.md) | Forward migrations and previous-runtime compatibility on disposable infrastructure          |
| [Live staging health smoke](staging-live-smoke.md)                  | Explicit isolated HTTPS staging target and read-only health checks                          |
| [Staging evidence inventory](staging-readiness-inventory.md)        | Reference completeness only; no verification of actual evidence or deployment authorization |

## Production preparation and recovery

| Runbook                                                                | Scope                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Independent release readiness review](production-readiness-review.md) | Read-only release-chain review; not production GO            |
| [Digest-only Compose preflight](production-digest-preflight.md)        | Immutable verified image policy                              |
| [Operator host preflight](production-host-preflight.md)                | Read-only host verification                                  |
| [Backup and restore](backup-restore-operations.md)                     | Opt-in backup, restore and recovery monitoring               |
| [Production observability](production-observability.md)                | Opt-in host monitoring and offline verification              |
| [Notification operations](notifications.md)                            | Protected queue telemetry, incident and retention boundaries |

## Related guides

- [OVRANTO transactional SMTP](cloudflare-smtp.md) — Cloudflare configuration and isolated staging recipient restriction.

- [Production reliability foundation](production-reliability-foundation.md) — pool budget, dependency health, lifecycle and replica test boundaries.
- [Production Compose baseline](../../infra/docker/production/README.md)
- [Local development and Docker](../../infra/docker/README.md)
- [Frozen database baseline and migration policy](../database-baseline-reset.md)
- [Redis 8 upgrade rehearsal](../infra/redis-8-upgrade.md)
- [Native staging smoke](../../apps/mobile/docs/native-staging-smoke.md)
- [Closed Beta evidence gates](../beta-readiness-gates.md)
- [Development and CI](../development/README.md)

Commands and inline repository paths in the runbooks retain their original working-directory assumptions. Old root-level paths contain link-only notices for historical references. Use the canonical paths for new links.
