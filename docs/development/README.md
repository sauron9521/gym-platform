# Development and CI guides

This is the canonical navigation for repository development and quality checks. Local application setup is documented in the [Docker/local development guide](../../infra/docker/README.md); architecture decisions remain in the [ADR register](../architecture/README.md).

| Guide                                                        | Purpose                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [Testing conventions](testing.md)                            | Vitest, Playwright, Maestro, mandatory CI contracts and scanner policy |
| [CI affected workspaces](ci-affected-workspaces.md)          | Conservative routing and protected result gates                        |
| [Selective pre-push checks](pre-push-checks.md)              | Local Git hook scope and Windows process safety                        |
| [Dependency-cruiser boundaries](dependency-cruiser-pilot.md) | Workspace graph checks and import restrictions                         |
| [Build-time environment](turbo-build-environment.md)         | Turborepo cache inputs and environment boundaries                      |
| [Tooling diagnostic guide](tooling-audit.md)                 | Knip, Turbo and dependency-cruiser diagnostics and recorded findings   |

## Evidence and follow-up

- [Custom script replacement audit](../custom-scripts-replacement-audit.md)
- [Turbo affected shadow evidence (2026-11-24)](../turbo-affected-shadow-evidence-2026-11-24.md)

The existing CI selector and branch protection remain authoritative. A diagnostic result or this directory move is not release approval. Old root-level guide paths retain link-only migration notices for historical GitHub references; update new links to the canonical pages above.
