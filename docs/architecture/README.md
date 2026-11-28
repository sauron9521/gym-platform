# Architecture decision register

Reviewed against main and linked issues on 2026-11-24. Decision acceptance, implementation evidence and release authorization are separate states. This index does not grant new approvals or close issues.

## Decisions

| ID      | Decision                                                                                  | Decision status                        | Implementation / follow-up                                                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-005 | [Product ownership and Trainer migration](adr-005-product-ownership-trainer-migration.md) | Accepted, 2026-11-19                   | Partial; protected Trainer workspace exists, legacy cutover pending ([#359](https://github.com/sauron9521/gym-platform/issues/359), [#367](https://github.com/sauron9521/gym-platform/issues/367))               |
| ADR-006 | [Shared package boundaries](adr-006-shared-package-boundaries.md)                         | Accepted direction, 2026-11-28         | SP01–SP10 approved; source-level reconciliation and implementation acceptance pending ([#370](https://github.com/sauron9521/gym-platform/issues/370))                                                            |
| ADR-007 | [Pragmatic Clean Architecture](adr-007-pragmatic-clean-architecture.md)                   | Accepted; limited owner GO, 2026-11-24 | Selected complex writes only; CA06–CA08 verified, CA09 guidance merged, final acceptance pending ([#718](https://github.com/sauron9521/gym-platform/issues/718))                                                 |
| ADR-008 | [Unified Notifications](notifications.md)                                                 | Accepted target, 2026-11-21            | Design only; delivery implementation not established ([#563](https://github.com/sauron9521/gym-platform/issues/563))                                                                                             |
| ADR-009 | [Client state ownership and scoped store pilot](adr-009-client-state-management.md)       | Accepted limited direction, 2026-11-27 | Mobile #892/#893/#895/#896 merged; [SM05 evaluation](adr-009-pilot-evaluation.md), [SM08 Trainer review](adr-009-trainer-editor-state.md); native acceptance pending                                             |
| ADR-010 | [Segregated API interfaces](adr-010-segregated-api-interfaces.md)                         | Accepted target, 2026-11-26            | Users and Auth migrated; [ABI04e review](adr-010-users-pilot-review.md), [ABI05e review](adr-010-auth-migration-review.md), ABI06 pending review ([#909](https://github.com/sauron9521/gym-platform/issues/909)) |

ADR-008 previously used the duplicate identifier ADR-006. Keep the existing `notifications.md` path and historical links; the number is a registry correction, not a new design decision. ADR-001–004 are not present in the current tracked architecture inventory; do not infer their contents or reuse their identifiers.

## ADR-007 implementation evidence

| Stage | Evidence                                                                 | Status at review                                         |
| ----- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| CA05  | [Publication pilot evaluation](adr-007-pilot-evaluation.md)              | Limited owner GO verified                                |
| CA06  | [Training Programs](adr-007-training-programs-expansion.md)              | Selected implementation and evidence merged; #724 closed |
| CA07  | [Workouts](adr-007-workouts-expansion.md)                                | Selected implementation and evidence merged; #725 closed |
| CA08  | [Trainer–Athletes](adr-007-trainer-athletes-expansion.md)                | Selected implementation and evidence merged; #726 closed |
| CA09  | [Future operation adoption checklist](adr-007-future-module-adoption.md) | #789 merged; #727 and epic #718 still open at review     |

CA01–CA04 are described in the decision and pilot record. Evidence pages are dated snapshots, not additional ADR identifiers or a claim that every module has been migrated. Ordinary CRUD/read paths retain their existing structure unless a justified operation needs a boundary.

## Notification supporting contracts

- [Event taxonomy and ownership](notification-events.md)
- [Delivery, scheduling and failure policy](notification-delivery.md)
- [Workout schedule presentation semantics](workout-schedule-semantics.md): proposed civil-day calendar status and timezone rules (#341), pending owner acceptance.
- [Datetime adoption inventory](datetime-adoption.md): approved library direction and staged migration evidence.

These refine ADR-008 and retain its implementation and security gates.

- [Background Workers Strategy v1.0](../product-strategy/background-workers-strategy-v1.md): accepted BW01–BW10 direction; extends ADR-008, preserves existing gates and defers worker separation until ABI08 and explicit Backend Core decision. No new ADR, runtime or release approval.

## Cross-cutting observability strategy

- [Observability & Monitoring Strategy v1.0](../product-strategy/observability-monitoring-strategy-v1.md): OM01–OM10 accepted direction; complements S06 and BW08, retains existing implementation owners and acceptance gates. No new ADR, dependency or release approval.

## Account preferences supporting contract

- [Account workout preferences — incremental rollout](account-workout-preferences.md): proposed delivery contract for account/device ownership, shared defaults and safe synchronization.

## Maintaining the register

Assign a unique new identifier for each new decision, record its date, scope, owner review status, related issue and implementation evidence. Distinguish Proposed, Accepted, Superseded and Rejected decisions; keep evidence and partial delivery status separate. Preserve old document paths or update references deliberately. Do not overwrite the historical rationale, infer owner approval from a merge, or claim production readiness from architecture acceptance. Update this index in the same PR when an ADR or its status changes.
