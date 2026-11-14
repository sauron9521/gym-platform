import type { operations } from '@gym/api-client';
import { z } from 'zod';

import { numericText } from './workout-set-form';

type ExerciseListResponse =
  operations['ExercisesController_findMany']['responses'][200]['content']['application/json'];
export type ExerciseListItem = ExerciseListResponse['data'][number];

export type CreateWorkoutPayload =
  operations['WorkoutsController_create']['requestBody']['content']['application/json'];

export const workoutSetTypes = ['WARMUP', 'WORKING', 'DROP_SET', 'AMRAP'] as const;

export const createWorkoutSetFormSchema = z.object({
  setType: z.enum(workoutSetTypes),
  plannedReps: numericText(1, 1000, 0, true),
  plannedWeightKg: numericText(0, 999999.99, 2),
  plannedDurationSeconds: numericText(1, 604800, 0, true),
  plannedDistanceMeters: numericText(0, 99999999.99, 2),
  restSeconds: numericText(0, 86400, 0, true),
  targetRpe: numericText(1, 10, 1),
  targetRir: numericText(0, 10, 0, true),
});

const createWorkoutExerciseFormSchema = z.object({
  exerciseId: z.uuid(),
  exerciseName: z.string().min(1),
  notes: z.string().trim().max(5000),
  sets: z.array(createWorkoutSetFormSchema).min(1).max(100),
});

export const createWorkoutFormSchema = z.object({
  title: z.string().trim().min(2, 'Вкажіть назву (мінімум 2 символи).').max(120),
  notes: z.string().trim().max(5000),
  scheduledAt: z.string().refine(
    (value) => value === '' || !Number.isNaN(new Date(value).getTime()),
    'Вкажіть коректну дату.',
  ),
  exercises: z
    .array(createWorkoutExerciseFormSchema)
    .min(1, 'Додайте хоча б одну вправу.')
    .max(50)
    .superRefine((exercises, ctx) => {
      const seen = new Set<string>();
      for (const [index, exercise] of exercises.entries()) {
        if (seen.has(exercise.exerciseId)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Цю вправу вже додано.',
            path: [index, 'exerciseId'],
          });
        }
        seen.add(exercise.exerciseId);
      }
    }),
});

export type CreateWorkoutValues = z.infer<typeof createWorkoutFormSchema>;

type WorkoutSetFormValues = CreateWorkoutValues['exercises'][number]['sets'][number];

export function createEmptyWorkoutSet(): WorkoutSetFormValues {
  return {
    setType: 'WORKING',
    plannedReps: '',
    plannedWeightKg: '',
    plannedDurationSeconds: '',
    plannedDistanceMeters: '',
    restSeconds: '',
    targetRpe: '',
    targetRir: '',
  };
}

export function createWorkoutExercise(exercise: ExerciseListItem) {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    notes: '',
    sets: [createEmptyWorkoutSet()],
  };
}

function optionalNumber(value: string): number | null {
  return value === '' ? null : Number(value.replace(',', '.'));
}

export function buildCreateWorkoutPayload(values: CreateWorkoutValues): CreateWorkoutPayload {
  return {
    title: values.title.trim(),
    notes: values.notes.trim() || null,
    scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null,
    exercises: values.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      notes: exercise.notes.trim() || null,
      sets: exercise.sets.map((set) => ({
        setType: set.setType,
        plannedReps: optionalNumber(set.plannedReps),
        plannedWeightKg: optionalNumber(set.plannedWeightKg),
        plannedDurationSeconds: optionalNumber(set.plannedDurationSeconds),
        plannedDistanceMeters: optionalNumber(set.plannedDistanceMeters),
        restSeconds: optionalNumber(set.restSeconds),
        targetRpe: optionalNumber(set.targetRpe),
        targetRir: optionalNumber(set.targetRir),
      })),
    })),
  };
}

export function getCreateWorkoutErrorMessage(status?: number): string {
  if (status === 400) return 'Перевірте заповнені дані тренування.';
  if (status === 403 || status === 404) return 'Одна з вправ недоступна для вашого акаунта.';
  if (status === 409) return 'Тренування вже змінено. Перевірте дані та спробуйте ще раз.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося створити тренування. Перевірте з’єднання та спробуйте ще раз.';
}
