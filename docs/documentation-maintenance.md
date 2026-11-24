# Documentation maintenance

## Ownership and location

| Document type                                | Canonical location                                    |
| -------------------------------------------- | ----------------------------------------------------- |
| Application setup and current feature map    | `apps/<app>/README.md`                                |
| Shared package public contract               | `packages/<package>/README.md`                        |
| API module behavior and contracts            | `docs/api/`                                           |
| Architecture decisions and adoption evidence | `docs/architecture/`                                  |
| Developer workflows and tooling              | `docs/development/`                                   |
| Product-specific technical guides            | `docs/admin/`, `docs/mobile/`, `docs/landing/`        |
| Design decisions and visual slices           | `docs/design/`                                        |
| Infrastructure and operator runbooks         | `docs/infra/`, `docs/operations/`, `infra/`           |
| Cross-cutting security                       | `docs/security/`                                      |
| Dated audit snapshots                        | `docs/audits/`                                        |
| Approved strategy and governance             | `docs/product-strategy/`, `docs/business-governance/` |

The root [documentation index](README.md) links the thematic indexes and existing cross-cutting database, migration and Beta gates. Keep their paths stable unless a deliberate migration updates all consumers.

## Review checklist

1. Update the owning guide in the same PR as a changed public contract, route, configuration or operational procedure. Link new documents from the nearest index.
2. Prefer references to manifests, source, generated OpenAPI and checked commands rather than duplicating contracts or version numbers. Never include real credentials or production personal data.
3. Distinguish implemented behavior from target designs, historical observations and explicitly deferred work. Date snapshots, pin the source SHA and preserve test scope and limitations. Owner approval and deployment acceptance are separate.
4. Before moving documents, check Markdown links and non-Markdown references in code, workflows and tests. Update relative destinations, retain a link-only notice at old paths when historical GitHub references need it, and keep command working directories explicit. Old heading anchors do not automatically redirect.
5. Run repository formatting and relative-link checks before review. At this stage only manual link-target checking is established; automated documentation-specific checks will be added separately. Do not infer that all anchors or external URLs were verified.
6. Keep the change narrow, verify required CI, and leave merge to the owner. Do not close issues or change security/release gates just because documentation was reorganized.

## Legacy paths

The following link-only notices exist for compatibility, not as independently maintained content. New documentation should link to their destinations.

- [admin-account-status-lifecycle.md](admin-account-status-lifecycle.md)
- [admin-atomic-account-revocation.md](admin-atomic-account-revocation.md)
- [admin-dashboard-roadmap.md](admin-dashboard-roadmap.md)
- [admin-users-read-api.md](admin-users-read-api.md)
- [api-migration-audit.md](api-migration-audit.md)
- [backup-restore-operations.md](backup-restore-operations.md)
- [ci-affected-workspaces.md](ci-affected-workspaces.md)
- [custom-scripts-replacement-audit.md](custom-scripts-replacement-audit.md)
- [dependency-cruiser-pilot.md](dependency-cruiser-pilot.md)
- [frontend-fsd-boundaries.md](frontend-fsd-boundaries.md)
- [github-project-delivery.md](github-project-delivery.md)
- [github-roadmap-milestones.md](github-roadmap-milestones.md)
- [offline-workout-drafts.md](offline-workout-drafts.md)
- [post-s12-implementation-audit.md](post-s12-implementation-audit.md)
- [pre-push-checks.md](pre-push-checks.md)
- [production-digest-preflight.md](production-digest-preflight.md)
- [production-host-preflight.md](production-host-preflight.md)
- [production-observability.md](production-observability.md)
- [production-readiness-review.md](production-readiness-review.md)
- [release-ghcr.md](release-ghcr.md)
- [security-audit-exceptions.md](security-audit-exceptions.md)
- [staging-ghcr-monorepo.md](staging-ghcr-monorepo.md)
- [staging-live-smoke.md](staging-live-smoke.md)
- [staging-readiness-inventory.md](staging-readiness-inventory.md)
- [staging-two-release-rollback.md](staging-two-release-rollback.md)
- [testing.md](testing.md)
- [tooling-audit.md](tooling-audit.md)
- [turbo-affected-shadow-evidence-2026-11-24.md](turbo-affected-shadow-evidence-2026-11-24.md)
- [turbo-build-environment.md](turbo-build-environment.md)
- [web-capability-route-guards.md](web-capability-route-guards.md)
