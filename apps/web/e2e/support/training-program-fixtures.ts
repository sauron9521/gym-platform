import { randomUUID } from 'node:crypto';

import { withDisposableDatabase } from './real-api-accounts';

export type SeededProgram = {
  id: string;
  versionId: string;
  title: string;
};

/**
 * These are read-only Web list tests, not an API program-builder test. Create
 * consistent, fully linked records in a disposable PostgreSQL database while
 * leaving real NestJS auth, list projections and ownership policies enabled.
 */
export async function seedTrainingProgram(
  trainerId: string,
  title: string,
  status: 'DRAFT' | 'PUBLISHED',
): Promise<SeededProgram> {
  const id = randomUUID();
  const versionId = randomUUID();

  await withDisposableDatabase(async (db) => {
    await db.query('BEGIN', []);
    try {
      await db.query(
        'INSERT INTO "training_programs" ("id", "trainer_id", "status") VALUES ($1, $2, $3)',
        [id, trainerId, status],
      );
      await db.query(
        'INSERT INTO "training_program_versions" ("id", "program_id", "version", "title", "description", "duration_weeks", "status") VALUES ($1, $2, 1, $3, $4, 2, $5)',
        [versionId, id, title, 'Real browser E2E program', status],
      );

      if (status === 'PUBLISHED') {
        // A published version must be executable: workout -> exercise -> set.
        // The global exercise exists because integration CI applies db:seed.
        const found = await db.query(
          'SELECT "id" FROM "exercises" WHERE "slug" = $1 AND "source" = $2 LIMIT 1',
          ['barbell-bench-press', 'GLOBAL'],
        );
        const exerciseId = found.rows[0]?.['id'];
        if (typeof exerciseId !== 'string') {
          throw new Error('Integration fixture requires the seeded global bench press exercise');
        }

        const workoutId = randomUUID();
        const programExerciseId = randomUUID();
        await db.query(
          'INSERT INTO "training_program_workouts" ("id", "version_id", "week_number", "day_number", "title") VALUES ($1, $2, 1, 1, $3)',
          [workoutId, versionId, 'Day 1'],
        );
        await db.query(
          'INSERT INTO "training_program_exercises" ("id", "workout_id", "exercise_id", "exercise_name_snapshot", "exercise_type_snapshot", "sort_order") VALUES ($1, $2, $3, $4, $5, 0)',
          [programExerciseId, workoutId, exerciseId, 'Barbell Bench Press', 'STRENGTH'],
        );
        await db.query(
          'INSERT INTO "training_program_sets" ("id", "program_exercise_id", "set_number", "planned_reps") VALUES ($1, $2, 1, 8)',
          [randomUUID(), programExerciseId],
        );
        await db.query(
          'UPDATE "training_program_versions" SET "published_at" = NOW() WHERE "id" = $1',
          [versionId],
        );
      }
      await db.query('COMMIT', []);
    } catch (error) {
      await db.query('ROLLBACK', []);
      throw error;
    }
  });

  return { id, versionId, title };
}

/** This trainer is a reference fixture, not a login-capable browser account. */
export async function seedReferenceTrainer(): Promise<string> {
  const id = randomUUID();
  await withDisposableDatabase(async (db) => {
    const result = await db.query(
      'INSERT INTO "users" ("id", "email", "password_hash", "role") VALUES ($1, $2, $3, $4)',
      [id, 'program-fixture-' + id + '@example.test', 'not-a-usable-password-hash', 'TRAINER'],
    );
    if (result.rowCount !== 1) throw new Error('Could not insert reference trainer');
  });
  return id;
}

export async function seedActiveAssignment(
  trainerId: string,
  athleteId: string,
  versionId: string,
): Promise<string> {
  const relationshipId = randomUUID();
  const assignmentId = randomUUID();

  await withDisposableDatabase(async (db) => {
    await db.query('BEGIN', []);
    try {
      await db.query(
        'INSERT INTO "trainer_athletes" ("id", "trainer_id", "athlete_id", "initiated_by_id", "status", "responded_at") VALUES ($1, $2, $3, $2, $4, NOW())',
        [relationshipId, trainerId, athleteId, 'ACTIVE'],
      );
      await db.query(
        'INSERT INTO "training_program_assignments" ("id", "version_id", "trainer_athlete_id", "athlete_id", "assigned_by_id", "status") VALUES ($1, $2, $3, $4, $5, $6)',
        [assignmentId, versionId, relationshipId, athleteId, trainerId, 'ACTIVE'],
      );
      await db.query('COMMIT', []);
    } catch (error) {
      await db.query('ROLLBACK', []);
      throw error;
    }
  });

  return assignmentId;
}
