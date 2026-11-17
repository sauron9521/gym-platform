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

/** Multiple exercises, each with its own planned working sets. */
const mobilePlannedSetSchema = z.object({
  reps: z.string().regex(/^\d+$/, 'Вкажіть ціле число повторень.').refine(
    (value) => Number(value) >= 1 && Number(value) <= 1000,
    'Повторення: 1–1000.',
  ),
  weightKg: z.string().trim().regex(/^\d*(?:[.,]\d{1,2})?$/, 'Вага: до 2 знаків після коми.').refine(
    (value) => value === '' || Number(value.replace(',', '.')) <= 999999.99,
    'Вага завелика.',
  ),
});

export const mobileMultiWorkoutFormSchema = z.object({
  title: z.string().trim().min(2).max(120),
  exercises: z.array(z.object({
    exerciseId: z.uuid('Оберіть вправу.'),
    sets: z.array(mobilePlannedSetSchema).min(1).max(100),
  })).min(1).max(50),
});

export type MobileMultiWorkoutForm = z.infer<typeof mobileMultiWorkoutFormSchema>;

export function buildMobileMultiWorkoutBody(form: MobileMultiWorkoutForm): CreateWorkoutBody {
  return {
    title: form.title.trim(),
    exercises: form.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({
        setType: 'WORKING' as const,
        plannedReps: Number(set.reps),
        ...(set.weightKg.trim()
          ? { plannedWeightKg: Number(set.weightKg.replace(',', '.')) }
          : {}),
      })),
    })),
  };
}
