# Trainer overview read model (#312)

`GET /trainer-dashboard/overview` is a small aggregate **read-only** endpoint
inside the existing NestJS TrainerAthletes module; no additional User identity,
database table, or duplicated TrainerAthlete/TrainingProgram business services.

Access requires the existing session-cookie or bearer authentication, plus a
**current server-side trainer capability** from `UsersService.findMyCapabilities`.
ATHLETE-only, ADMIN, pending and revoked trainers receive **403**; anonymous
requests receive **401**. An ATHLETE-role account with an approved active
TrainerProfile is allowed.

Response fields:

| Field                         | Meaning                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asOf`                        | Server UTC timestamp when the counts were requested                                                                                                               |
| `windowStart`                 | Exactly 30 days before `asOf`                                                                                                                                     |
| `activeClients`               | Number of current `ACTIVE` TrainerAthlete relationships owned by this trainer                                                                                     |
| `activeProgramAssignments`    | Current `ACTIVE` assignments tied to those active relationships **and to programs owned by this trainer**                                                         |
| `completedProgramWorkouts30d` | `COMPLETED` workouts with `completedAt` in `[windowStart, asOf)` and an `ACTIVE` or `COMPLETED` assignment for this trainer's program and currently active client |

The endpoint is intentionally **not** a count of every personal workout. It
measures only completed workouts explicitly linked to the trainer's assigned
programs. Program editing, athlete-level progress and nonprogram workout
analytics remain owned by their existing modules.

The repository performs **exactly three PostgreSQL count queries in one
transaction**, with owner, live TrainerProfile/legacy Trainer eligibility,
athlete existence and active collaboration predicates repeated inside SQL.
No unbounded `findMany`, N+1, client-side filtering, stale token-role trust,
historical/terminated relationship disclosure or names/emails are returned.
`/trainer-athletes?scope=trainer&status=ACTIVE` remains the paginated source
for client rows.

## Checks

- Unit: `trainer-dashboard.service.spec.ts` and `trainer-dashboard.repository.spec.ts`.
- Integration: `test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts`,
  with separate trainers, assigned programs, completed/old/planned workouts,
  401/403, and a capability revocation with a still-present session.
- OpenAPI and `@gym/api-client` generated contract change in the same PR.

## Individual active-client progress read model (#364)

`GET /trainer-dashboard/clients/:relationId/progress` accepts a **TrainerAthlete
relationship ID** (validated UUID), not an arbitrary athlete ID. It returns only
`asOf`, `windowStart` (30 days), `activeProgramAssignments`, and
`completedProgramWorkouts30d`, using the same definitions as `overview`
restricted to exactly that active, trainer-owned relationship.

- Existing authenticated sessions only; **current** trainer grant required.
  Anonymous is 401; ATHLETE-only, ADMIN or revoked trainers are 403.
- **404** equally for nonexistent, another trainer's, terminated, pending, or
  otherwise disallowed relationships. No contact fields, emails, athlete IDs,
  unassigned/personal workouts or workout notes are returned.
- The repository executes **exactly three fixed PostgreSQL reads in one
  transaction**: scoped relationship existence plus two DB-side counts.
  Each count independently repeats trainer, currently approved account,
  active relationship, owned program, assignment and time-window conditions.
  No list-then-filter / N+1. A revocation during the request cannot expose
  previously authorized counts for other athletes.
- Unit, controller and actual PostgreSQL HTTP E2E verify same-tenant counts,
  foreign/ended 404, denied/expired 401–403, and no foreign athlete data.

This is a **backend-only** slice; the next small PR may connect a protected
Trainer Web client details page using this generated typed contract, with no
new auth mechanisms or personal workout access changes.

## Historical overview

The initial #312 PR delivered API-only `overview`; Trainer Web KPI tiles
were subsequently integrated under #364. No additional User identity or
parallel training domain was introduced.
