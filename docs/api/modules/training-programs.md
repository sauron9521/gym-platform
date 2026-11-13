# Training programs module

**Source:** [`apps/api/src/modules/training-programs/`](../../../apps/api/src/modules/training-programs/)

Programs have versioned content. This module manages program lifecycle, versions (draft/published), workouts, exercises, sets, athlete assignments and assignment transitions. All exposed controllers advertise bearer authentication.

## HTTP route groups

- **Programs:** `POST /training-programs`, `GET /training-programs`, `GET /training-programs/:programId`, `DELETE /training-programs/:programId`
- **Versions:** `GET /training-programs/:programId/versions`, `POST .../versions/drafts`, `GET|PATCH .../versions/:versionId`, `POST .../versions/:versionId/publish`
- **Program workouts:** `POST .../versions/:versionId/workouts`, `PATCH|DELETE .../workouts/:workoutId`
- **Program exercises:** `POST .../workouts/:workoutId/exercises`, `PATCH .../exercises/reorder`, `PATCH|DELETE .../exercises/:exerciseId`
- **Sets:** `POST .../exercises/:exerciseId/sets`, `PATCH .../sets/reorder`, `PATCH|DELETE .../sets/:setId`
- **Assignments:** `GET /training-programs/assignments`, `GET /training-programs/assignments/:assignmentId`, `POST .../assignments/:assignmentId/complete`, `POST .../assignments/:assignmentId/cancel`, `POST /training-programs/:programId/versions/:versionId/assignments`

The ellipsis above stands for the **same** `/training-programs/:programId/versions/:versionId` prefix; consult controllers or generated OpenAPI for a copyable full URL.

## Invariants and verification

Protect draft/published/archived rules, immutable published content, concurrent draft creation, trainer authorization, assignment ownership, workout linkage and completion/cancellation transitions. Changes across services/repositories should be tested at the HTTP and PostgreSQL levels.

**Tests:** `test/integration/training-programs/training-program-*.integration.e2e-spec.ts`, module unit tests, and linked `test/e2e/workouts/workouts.e2e-spec.ts` flows. For every contract change, regenerate OpenAPI and the frontend client.

See [workouts](workouts.md), [trainer–athletes](trainer-athletes.md), and [testing guide](../testing.md).
