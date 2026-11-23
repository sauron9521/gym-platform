# Training program assignments — trainer-scoped client preview

The existing `GET /training-programs/assignments` endpoint retains its
participant-owned (trainer + athlete-side history) behavior when the optional
`trainerAthleteId` filter is absent. No new API module, User identity, Prisma
table, migration, or write operation is introduced.

## Opt-in active-client assignment filter (#364, #366)

To display assigned programs for one currently active client, the approved
trainer can request:

```http
GET /training-programs/assignments?trainerAthleteId=<relationship-uuid>&view=summary&page=1&limit=8
```

- `trainerAthleteId` must be the validated **TrainerAthlete relationship UUID**,
  not a bare athlete ID. `view=summary` is **required** whenever this filter
  is supplied; full assignment payloads can contain arbitrarily many workouts,
  and are deliberately unavailable in the preview.
- `page` and `limit` use the existing bounds (page >= 1, limit 1..100).
  `status` may independently select ACTIVE, COMPLETED, CANCELLED or TERMINATED
  assignments _within that currently active relationship_. The latest-first
  assignment ordering and paginated `data/meta` response are unchanged.
- A fresh persisted **trainer capability** and an **ACTIVE relationship owned
  by that trainer** are required, even if the caller is also an athlete.
  Anonymous callers get 401; athlete-only, ADMIN, and revoked trainers get 403.
  Missing, foreign, pending, ended or otherwise ineligible relationships all
  give a generic 404 rather than allowing inference of counts or titles.
- The SQL count, offset and selected assignment page are all filtered by
  relationship ID, trainer ownership, currently active relationship, program
  owner and the **live trainer approval policy**. The last check is repeated
  inside the actual SQL predicates so a grant revoked after a preflight
  relationship check cannot restore private program rows.
- Uses the existing `TrainingProgramAssignmentRepository.findManyAssignments`
  with `trainingProgramAssignmentSummarySelect`, rather than materializing
  cross-client rows then filtering in JavaScript; the historical participant
  read and redaction model stays unchanged for other callers.
- This is **backend-only** for a small, independently reviewable PR. A
  follow-on Trainer Web PR will render bounded client assignments using the
  regenerated `@gym/api-client` path/query types. There is no new client
  history/feedback service.

## Published program versions (#366)

`GET /training-programs/{programId}/published-versions` returns version
summaries ordered by version number descending for an active trainer's own
program. The response is `{ data, nextBeforeVersion }`. Page size defaults to
20 and accepts 1–40. To fetch older versions, send the previous response's
`nextBeforeVersion` as the exclusive `beforeVersion` query parameter. A
`null` cursor marks the last page, including when no version is published.

Drafts are excluded before pagination. Version numbers are unique within a
program, so publishing a newer version during paging does not shift older
results. Missing and foreign programs return 404. The existing
`GET /training-programs/{programId}/versions` still returns the full array
of version summaries.

## Verification

- Service/controller unit tests for opt-in SQL predicate and pagination,
  athlete / foreign / ended / revoked boundary, mandatory summary projection,
  and legacy participant-list compatibility.
- Existing HTTP + PostgreSQL
  `test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts` verifies owner
  program version and status, foreign and nonexistent relation 404s, athlete
  denial, invalid UUID, unbounded request failure, current grant revocation,
  and active relationship termination.
- The committed OpenAPI and `@gym/api-client` generated contract are updated
  together, and validated in the standard GitHub CI contract gate.
