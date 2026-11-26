import type { paths } from '@gym/api-client';
import { z } from 'zod';

import type { WorkoutDetails } from '../model/workout-details-query';

export type PreviousSets =
  paths['/workout-analytics/exercises/{exerciseId}/previous-sets']['get']['responses'][200]['content']['application/json'];
export type PreviousSetHint = PreviousSets['sets'][number];
type WorkoutSet = WorkoutDetails['exercises'][number]['sets'][number];

// Leave room in the shared 20/minute analytics budget for other requests.
export const maxPreviousSetExercises = 10;

const schema = z.strictObject({
  exerciseId: z.string().uuid(),
  workoutCompletedAt: z.iso.datetime({ offset: true }).nullable(),
  sets: z
    .array(
      z.strictObject({
        setNumber: z.number().int().min(1).max(100),
        setType: z.enum(['WARMUP', 'WORKING', 'DROP_SET', 'AMRAP']),
        actualReps: z.number().int().min(1).max(1000).nullable(),
        actualWeightKg: z.number().min(0).max(10000).nullable(),
      }),
    )
    .max(100),
});

export function parsePreviousSets(input: unknown, exerciseId: string): PreviousSets {
  const data = schema.parse(input);
  if (
    data.exerciseId !== exerciseId ||
    (data.sets.length === 0) !== (data.workoutCompletedAt === null) ||
    new Set(data.sets.map((set) => set.setNumber)).size !== data.sets.length ||
    data.sets.some((set) => set.actualReps === null && set.actualWeightKg === null)
  ) {
    throw new Error('Invalid previous sets response');
  }
  return data;
}

/** Request once per distinct strength exercise in the active workout; do not
 * progressively fetch more as sets are completed (bounded optional traffic). */
export function previousSetExerciseIds(
  workout: WorkoutDetails | undefined,
  accountId: string | null,
) {
  if (!accountId || workout?.athleteId !== accountId || workout.status !== 'IN_PROGRESS') return [];
  return [
    ...new Set(
      workout.exercises
        .filter((exercise) => exercise.exerciseTypeSnapshot === 'STRENGTH')
        .map((exercise) => exercise.exerciseId),
    ),
  ]
    .slice(0, maxPreviousSetExercises)
    .filter((id) =>
      workout.exercises.some(
        (exercise) =>
          exercise.exerciseId === id &&
          exercise.exerciseTypeSnapshot === 'STRENGTH' &&
          exercise.sets.some((set) => set.status === 'PENDING'),
      ),
    );
}

/** Historical values are display-only, never a source of form defaults. */
export function previousSetHint(
  history: PreviousSets | undefined,
  set: WorkoutSet,
): PreviousSetHint | undefined {
  if (set.status !== 'PENDING') return undefined;
  return history?.sets.find(
    (previous) => previous.setNumber === set.setNumber && previous.setType === set.setType,
  );
}
