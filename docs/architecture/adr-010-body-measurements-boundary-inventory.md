# ADR-010 — ABI06b3a Body measurements boundary inventory

- **Baseline:** [main de2ff97](https://github.com/sauron9521/gym-platform/commit/de2ff97bf792d4283f3e025c26808e0ce920b261), after #949 merged.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md).
- **Scope:** prepare explicit application contracts. Keep the existing controller in BodyMeasurementsModule.

## Routes and audience

| Method and path                   | Operation ID                          | Success | IP/min |
| --------------------------------- | ------------------------------------- | ------: | -----: |
| POST /body-measurements           | BodyMeasurementsController_create     |     201 |     10 |
| GET /body-measurements            | BodyMeasurementsController_findMany   |     200 |     10 |
| GET /body-measurements/statistics | BodyMeasurementsController_statistics |     200 |     10 |
| GET /body-measurements/:id        | BodyMeasurementsController_findOne    |     200 |     10 |
| PATCH /body-measurements/:id      | BodyMeasurementsController_update     |     200 |     10 |
| DELETE /body-measurements/:id     | BodyMeasurementsController_remove     |     204 |     10 |

All six routes inherit the global IP budget and use ordinary authenticated cookie or bearer identity. Proposed ownership is Athlete API, not a new role restriction: preserve access for any currently eligible authenticated owner. No trainer access to another user's measurements is introduced. The canonical generated client contains the operations; no literal body-measurement consumer was found in the inspected Web/Mobile/Trainer/Admin and shared package source outside generated schema. This is not proof of absence of indirect clients.

## Public boundary

[public-api.ts](../../apps/api/src/modules/body-measurements/public-api.ts) exports the two existing narrow application services, five existing request schemas and their DTO types. BodyMeasurementsService owns create, findMany, findOne, update and remove; BodyMeasurementStatisticsService owns getStatistics. The module exports exactly those two provider instances. Both repositories, Prisma projections, mapper internals, metric SQL allowlist and UTC period helpers remain private. Owner identity comes from the authenticated adapter, not the client request; the services do not independently authenticate callers.

Preserve strict schema validation, timestamp and decimal conversion, pagination and owner-scoped reads/mutations. Update locks the owned measurement row, checks the last non-null metric and retains the independent database constraint. Statistics uses a repeatable-read snapshot, allowlisted SQL column identifiers, first/latest points, rolling 7/30/90-day changes and UTC calendar-day series; no algorithm or query changes. Profile weight remains independent.

Boundary tests pin the exact provider/schema exports and deny extra client-supplied owner IDs. A test-only importing module verifies the two existing singleton services, private repository ownership and unchanged controller registration in the real Nest application. Existing controller tests consume the public types, and the original HTTP and persistence regressions remain intact.

## Next slice

ABI06b3b introduces the Athlete API composition and its BodyMeasurements leaf only when the real controller moves. Preserve original class/handler names, metadata, global rate budgets and static statistics-before-dynamic-id ordering. Add the audience manifest and literal empty core controllers. The frozen migration inventory includes the original controller and its adapter spec: add exact historical relocation entries for those files only; retain the core registry test and leave the frozen inventory and relocation validator unchanged. Verify canonical contracts, owner isolation, actual route precedence and runtime provider ownership before manual merge. No policy, schema, dependency or deployment change.

## ABI06b3b Athlete API relocation

[AthleteApiModule](../../apps/api/src/api/athlete/athlete-api.module.ts) composes the first actual Athlete leaf, [AthleteBodyMeasurementsApiModule](../../apps/api/src/api/athlete/body-measurements/athlete-body-measurements-api.module.ts), which owns the entire [BodyMeasurementsController](../../apps/api/src/api/athlete/body-measurements/controllers/body-measurements.controller.ts). Only its contract import changes. Core retains both existing service exports, private repositories and explicitly zero controllers. The audience manifest declares athlete. Class/handler identity, schemas, auth, global rate budgets, response status and static statistics route precedence remain unchanged. Two exact historical controller/spec relocation entries preserve frozen inventory evidence; the existing core registry remains at its original path. The new leaf registry and Nest composition tests pin unique ownership. A legacy TRAINER owner HTTP regression confirms that audience organization does not impose a new role gate, including private statistics and cross-owner denial.

All six measurement routes are audience-owned. Next ABI06b4a prepares WorkoutAnalytics contracts; no policy, persistence or deployment changes.
