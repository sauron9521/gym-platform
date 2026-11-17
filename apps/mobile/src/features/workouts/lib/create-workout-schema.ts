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

/** Planned sets follow the API limits: 1–1000 reps, non-negative Decimal(8,2) kg. */
const repsTextSchema = z.string().regex(/^\d+$/, 'Вкажіть ціле число повторень.');
const plannedRepsSchema = repsTextSchema.refine(
  (value) => Number(value) >= 1 && Number(value) <= 1000,
  'Повторення: 1–1000.',
);

const weightFormat = /^\d*(?:[.,]\d{1,2})?$/;
const weightTextSchema = z.string().trim().regex(weightFormat, 'Вага: до 2 знаків після коми.');

function validWeight(value: string) {
  if (value === '') return true;
  return Number(value.replace(',', '.')) <= 999999.99;
}

const plannedWeightSchema = weightTextSchema.refine(validWeight, 'Вага завелика.');

const plannedSetSchema = z.object({
  reps: plannedRepsSchema,
  weightKg: plannedWeightSchema,
});

const multiExerciseSchema = z.object({
  exerciseId: z.uuid('Оберіть вправу.'),
  sets: z.array(plannedSetSchema).min(1).max(100),
});

export const mobileMultiWorkoutFormSchema = z.object({
  title: z.string().trim().min(2, 'Назва повинна містити щонайменше 2 символи.').max(120),
  exercises: z.array(multiExerciseSchema).min(1).max(50),
});

export type MobileMultiWorkoutForm = z.infer<typeof mobileMultiWorkoutFormSchema>;

function optionalWeight(weightKg: string) {
  if (weightKg === '') return {};
  return { plannedWeightKg: Number(weightKg.replace(',', '.')) };
}

export function buildMobileMultiWorkoutBody(form: MobileMultiWorkoutForm): CreateWorkoutBody {
  return {
    title: form.title.trim(),
    exercises: form.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({
        setType: 'WORKING' as const,
        plannedReps: Number(set.reps),
        ...optionalWeight(set.weightKg),
      })),
    })),
  };
}

/** Reuse the same idempotency key for the same canonical payload after ambiguous failures. */
export function resolveMultiWorkoutCreationAttempt(
  form: MobileMultiWorkoutForm,
  previous: WorkoutCreationAttempt | null,
  createKey: () => string,
): WorkoutCreationAttempt {
  const fingerprint = JSON.stringify(buildMobileMultiWorkoutBody(form));
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: createKey() };
}
