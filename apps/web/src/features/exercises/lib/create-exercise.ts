import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type CustomExerciseActorRole = 'ATHLETE' | 'TRAINER';
export type CreateExercisePayload =
  operations['ExercisesController_create']['requestBody']['content']['application/json'];

export const CREATE_EXERCISE_TYPES = [
  { value: 'STRENGTH', label: 'Силова' },
  { value: 'CARDIO', label: 'Кардіо' },
  { value: 'MOBILITY', label: 'Мобільність' },
  { value: 'PLYOMETRIC', label: 'Пліометрика' },
  { value: 'OTHER', label: 'Інша' },
] as const;

const slug = z.string().trim().min(1).max(80);

export const createExerciseFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Мінімум 2 символи.').max(120),
    description: z.string().trim().max(5000),
    instructions: z.string().trim().max(10000),
    exerciseType: z.enum(['STRENGTH', 'CARDIO', 'MOBILITY', 'PLYOMETRIC', 'OTHER']),
    visibility: z.enum(['PRIVATE', 'SELECTED_TRAINERS']),
    muscleGroups: z
      .array(z.object({ slug, role: z.enum(['PRIMARY', 'SECONDARY']) }))
      .min(1, 'Додайте принаймні одну групу м’язів.')
      .max(10, 'Максимум 10 груп.'),
    equipment: z.array(slug).max(20, 'Максимум 20 видів обладнання.'),
  })
  .superRefine((data, ctx) => {
    if (!data.muscleGroups.some((item) => item.role === 'PRIMARY')) {
      ctx.addIssue({
        code: 'custom',
        path: ['muscleGroups'],
        message: 'Потрібна хоча б одна основна м’язова група.',
      });
    }

    const muscles = data.muscleGroups.map((item) => item.slug);
    if (new Set(muscles).size !== muscles.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['muscleGroups'],
        message: 'М’язові групи не повинні повторюватися.',
      });
    }

    if (new Set(data.equipment).size !== data.equipment.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipment'],
        message: 'Обладнання не повинно повторюватися.',
      });
    }


  });

export type CreateExerciseValues = z.infer<typeof createExerciseFormSchema>;

export function buildCreateExercisePayload(
  values: CreateExerciseValues,
  actorRole: CustomExerciseActorRole,
): CreateExercisePayload {
  return {
    name: values.name.trim(),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(values.instructions.trim() ? { instructions: values.instructions.trim() } : {}),
    exerciseType: values.exerciseType,
    ...(actorRole === 'ATHLETE' ? { visibility: values.visibility } : {}),
    muscleGroups: values.muscleGroups.map((item) => ({
      slug: item.slug.trim(),
      role: item.role,
    })),
    equipment: values.equipment.map((item) => item.trim()),
  };
}

export function getCreateExerciseErrorMessage(status?: number): string {
  if (status === 400) {
    return 'Перевірте дані вправи: групи м’язів та обладнання мають існувати в довіднику.';
  }
  if (status === 403) return 'Немає дозволу створити вправу.';
  if (status === 409) return 'Конфлікт під час створення вправи. Перевірте каталог.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося створити вправу. Перевірте з’єднання або каталог перед повторенням.';
}
