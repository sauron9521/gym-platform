# Audits and technical evidence

This index separates dated observations from current operating procedures. Review the pinned source revision, scope and limitations before using any historical finding. A report, successful diagnostic run or merged documentation is not a current readiness certification or authorization to implement, close issues or deploy.

| Report                                                                         | Evidence scope                                                               | How to use it today                                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [API migration audit](api-migration-audit.md)                                  | Original repository import inventory and later baseline-policy clarification | Historical import evidence; retain documented cutover gates and consult current migration/runbooks |
| [Post-S12 implementation baseline](post-s12-implementation-audit.md)           | 2026-11-22; product strategy, issue triage and selected readiness evidence   | Recheck current main, issue status and explicit owner decisions before acting                      |
| [Custom scripts replacement audit](custom-scripts-replacement-audit.md)        | 2026-11-24; pinned top-level script inventory and tool candidates            | Starting point for incremental evaluations, not current script counts or approval to replace gates |
| [Turbo affected shadow evidence](turbo-affected-shadow-evidence-2026-11-24.md) | 2026-11-24; observed selector-versus-task-graph comparison                   | Preserve the recorded NO-GO for direct replacement; require new parity evidence for proposals      |

## Living guides and evidence in owning domains

- [Development tooling diagnostics and follow-up runs](../development/tooling-audit.md) — repeatable commands and subsequent Knip/Turbo evidence; kept with the development workflow rather than duplicated here.
- [Architecture decision register and CA05–CA09 evidence](../architecture/README.md) — decision ownership, verified slices and remaining acceptance.
- [API performance baseline](../api/performance-baseline.md) and [comparison](../api/performance-comparison.md) — measurement contracts and interpretation; not universal latency claims.
- [Dependency audit exception lifecycle](../security/security-audit-exceptions.md) — active security policy context and historical exception handling.

## Current gates and actions

Use the [development and CI guides](../development/README.md), [database migration policy](../database-baseline-reset.md), [migration quality gates](../migration-quality-gates.md), [operations runbooks](../operations/README.md), [security index](../security/README.md) and [Beta evidence gates](../beta-readiness-gates.md) for current procedures and requirements. These remain independent of an audit snapshot. Follow current issue/PR evidence before changing status.

Preserve original measurements, SHAs, run IDs, dates and caveats when relocating reports. Record later findings with their own evidence and distinguish superseded recommendations from still-applicable constraints. Former root paths retain compatibility notices; new links should use the canonical paths.
