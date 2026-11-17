import { z } from 'zod';
import type { operations } from '@gym/api-client';

export const mobileWorkoutFormSchema = z.object({
  title: z.string().trim().min(2, 'Назва повинна містити щонайменше 2 символи.').max(120),
  exerciseId: z.uuid('Оберіть вправу.'),
  reps: z
    .string()
    .regex(/^\d+$/, 'Введіть ціле число повторень.')
    .refine(
      (value) => Number(value) >= 1 && Number(value) <= 1000,
      'Кількість повторень має бути від 1 до 1000.',
    ),
});

export type MobileWorkoutForm = z.infer<typeof mobileWorkoutFormSchema>;

export type CreateWorkoutBody =
  operations['WorkoutsController_create']['requestBody']['content']['application/json'];

export type CreateOneWorkout = {
  title: string;
  exerciseId: string;
  plannedReps: number;
};

export function buildMobileWorkoutBody(input: CreateOneWorkout): CreateWorkoutBody {
  return {
    title: input.title.trim(),
    exercises: [
      {
        exerciseId: input.exerciseId,
        sets: [{ setType: 'WORKING', plannedReps: input.plannedReps }],
      },
    ],
  };
}

/** Reuse the same key when retrying an uncertain POST response with identical input. */
export type WorkoutCreationAttempt = { fingerprint: string; key: string };

export function resolveWorkoutCreationAttempt(
  input: CreateOneWorkout,
  previous: WorkoutCreationAttempt | null,
  createKey: () => string,
): WorkoutCreationAttempt {
  const fingerprint = JSON.stringify(buildMobileWorkoutBody(input));
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: createKey() };
}
