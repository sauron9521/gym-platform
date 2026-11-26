# Security and trust documentation

Navigation for technical security contracts, implementation evidence and remaining gates. This index does not grant privileged permissions, certify an audit, or authorize production deployment.

## Identity, authentication and authorization

- [API authentication module](../api/modules/auth.md) — authentication endpoints and token/session contracts.
- [Authentication production security gates](../api/auth-security-gates.md) — environment and authentication regression requirements.
- [API permission and ownership matrix](../api/permission-matrix.md) — endpoint authorization baseline.
- [Web capability route guards](web-capability-route-guards.md) — live persisted grants and protected pages.
- [Mobile authentication and capabilities](../../apps/mobile/README.md#live-account-capabilities-mobile--trainer) — native bearer transport and account boundaries.
- [Trainer workspace](../../apps/trainer/README.md#product-and-security-boundaries) — protected workspace and server-side grants.

## Privileged administration

- [Admin permission registry](../api/admin-permissions.md), [operator bootstrap](../api/superadmin-bootstrap.md) and [Admin audit architecture](../api/admin-audit-architecture.md).
- [Dedicated Admin cookie boundary](../admin/admin-cookie-only-boundary.md) — purpose, origin, expiration and scoped revocation.
- [Account suspension lifecycle](admin-account-status-lifecycle.md) and [atomic revocation](admin-atomic-account-revocation.md) — internal operations, no enabled suspend/reactivate HTTP route.
- [Account-status audit foundation](../admin/admin-account-status-audit.md) — transactional record and outstanding operational hardening.
- [Admin browser fixture smoke](../admin/admin-browser-cookie-smoke.md) and [external staging smoke](../admin/admin-external-staging-smoke.md) — distinct automated and deployed-host evidence.

## Dependency security and product policies

- [Dependency audit exception lifecycle](security-audit-exceptions.md) — historical withdrawn advisory and blocking audit commands; not a new vulnerability scan.
- [S05 Security & Trust](../product-strategy/s05-security-trust-v1.md) and [S03 Privacy & Data Ownership](../product-strategy/s03-privacy-data-ownership-v1.md) — approved product decisions, not implementation claims.
- [Account deletion intake](../api/modules/account-deletion-requests.md) — receipt only, not deletion completion.
- [Security stabilization regression review](stabilization-regression-review.md) — targeted regression coverage, residual risks and release limitations.
- [Beta evidence gates](../beta-readiness-gates.md) and [Operations](../operations/README.md) — independent rollout requirements.

API-specific contracts and Admin test evidence remain in their owning directories. Old root-level security documents contain compatibility links to canonical pages. Use the canonical paths for new references.
