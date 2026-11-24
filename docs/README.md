# OVRANTO / Gym Platform documentation

Start here for repository documentation. Current code, generated contracts, test evidence and approved decisions have different purposes. Production and Beta require independent explicit approval; this index does not authorize rollout.

## Start developing

- [Repository overview and application ports](../README.md)
- [Local development (Linux/macOS and Windows)](../infra/docker/README.md)
- [Development and CI](development/README.md) — testing, local checks, boundaries, build configuration and delivery tooling.

## Architecture and applications

| Area         | Entry point                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Architecture | [Decision register and implementation evidence](architecture/README.md)                                                     |
| API          | [Handbook](api/README.md) · [Local setup](../apps/api/README.md) · [Generated API client](../packages/api-client/README.md) |
| Athlete Web  | [Application guide](../apps/web/README.md)                                                                                  |
| Trainer Web  | [Application guide](../apps/trainer/README.md)                                                                              |
| Admin        | [Application guide](../apps/admin/README.md) · [Technical documentation](admin/README.md)                                   |
| Mobile       | [Application guide](../apps/mobile/README.md) · [Native documentation](mobile/README.md)                                    |
| Landing      | [Application guide](../apps/landing/README.md) · [Technical documentation](landing/README.md)                               |
| Design       | [OVRANTO design and visual evidence](design/README.md) · [Shared tokens](../packages/design-tokens/README.md)               |

## Operations and readiness

- [Infrastructure](infra/README.md) — Docker, Redis and database references.
- [Operations runbooks](operations/README.md) — signed releases, staging, rollback, preflight, backup and observability.
- [Database baseline and reset policy](database-baseline-reset.md) — frozen baseline and forward migration rules.
- [Migration quality gates](migration-quality-gates.md) — original quality-gate rationale; consult current development checks for changes.
- [Security and trust](security/README.md) — authentication, permissions, revocation and audit boundaries.
- [Closed Beta evidence gates](beta-readiness-gates.md) — NO_GO until independent evidence and owner approval.
- [Audits and technical evidence](audits/README.md) — historical findings and current follow-up references.

## Product and business decisions

- [Product strategy S01–S12](product-strategy/README.md) — approved and recorded, not feature implementation or release GO.
- [Business governance](business-governance/README.md) — staff responsibilities and approval policy.

## Documentation maintenance

- [Documentation ownership, placement and review rules](documentation-maintenance.md).

Application-specific setup remains beside the application; shared package contracts remain beside their packages. Compatibility notices at former paths are not separate source-of-truth guides.
