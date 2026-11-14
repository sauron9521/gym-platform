import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type CustomExerciseActorRole = 'ATHLETE' | 'TRAINER';
export type CreateExercisePayload =
  operations['ExercisesController_create']['requestBody']['content']['application/json'];

// These slugs mirror the checked-in Prisma seed. A taxonomy API should replace
// this static reference when users can administer muscle groups and equipment.
export const MUSCLE_OPTIONS = [
  { slug: 'chest', label: 'Грудні' },
  { slug: 'lats', label: 'Найширші м’язи спини' },
  { slug: 'upper-back', label: 'Верх спини' },
  { slug: 'lower-back', label: 'Низ спини' },
  { slug: 'shoulders', label: 'Плечі' },
  { slug: 'biceps', label: 'Біцепс' },
  { slug: 'triceps', label: 'Трицепс' },
  { slug: 'forearms', label: 'Передпліччя' },
  { slug: 'abs', label: 'М’язи живота' },
  { slug: 'obliques', label: 'Косі м’язи живота' },
  { slug: 'quadriceps', label: 'Квадрицепс' },
  { slug: 'hamstrings', label: 'Задня поверхня стегна' },
  { slug: 'glutes', label: 'Сідничні м’язи' },
  { slug: 'calves', label: 'Литки' },
  { slug: 'adductors', label: 'Привідні м’язи стегна' },
  { slug: 'abductors', label: 'Відвідні м’язи стегна' },
  { slug: 'hip-flexors', label: 'Згиначі стегна' },
  { slug: 'traps', label: 'Трапецієподібні м’язи' },
] as const;

export const EQUIPMENT_OPTIONS = [
  { slug: 'barbell', label: 'Штанга' },
  { slug: 'dumbbell', label: 'Гантелі' },
  { slug: 'ez-bar', label: 'EZ-гриф' },
  { slug: 'kettlebell', label: 'Гиря' },
  { slug: 'cable-machine', label: 'Блоковий тренажер' },
  { slug: 'smith-machine', label: 'Тренажер Сміта' },
  { slug: 'resistance-band', label: 'Еспандер' },
  { slug: 'pull-up-bar', label: 'Турнік' },
  { slug: 'dip-station', label: 'Бруси' },
  { slug: 'bench', label: 'Лава' },
  { slug: 'squat-rack', label: 'Силова рама' },
  { slug: 'leg-press-machine', label: 'Жим ногами' },
  { slug: 'leg-extension-machine', label: 'Розгинання ніг' },
  { slug: 'leg-curl-machine', label: 'Згинання ніг' },
  { slug: 'lat-pulldown-machine', label: 'Верхній блок' },
  { slug: 'chest-press-machine', label: 'Жим для грудей' },
  { slug: 'pec-deck-machine', label: 'Пек-дек' },
  { slug: 'calf-raise-machine', label: 'Тренажер для литок' },
  { slug: 'adductor-machine', label: 'Привідний тренажер' },
  { slug: 'abductor-machine', label: 'Відвідний тренажер' },
  { slug: 'treadmill', label: 'Бігова доріжка' },
  { slug: 'stationary-bike', label: 'Велотренажер' },
  { slug: 'rowing-machine', label: 'Гребний тренажер' },
  { slug: 'elliptical-machine', label: 'Еліптичний тренажер' },
  { slug: 'plyo-box', label: 'Пліобокс' },
  { slug: 'ab-wheel', label: 'Ролик для преса' },
  { slug: 'exercise-mat', label: 'Килимок' },
  { slug: 'bodyweight', label: 'Власна вага' },
] as const;

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

    const muscleSlugs = new Set(MUSCLE_OPTIONS.map((item) => item.slug));
    if (muscles.some((item) => !muscleSlugs.has(item as (typeof MUSCLE_OPTIONS)[number]['slug']))) {
      ctx.addIssue({
        code: 'custom',
        path: ['muscleGroups'],
        message: 'Оберіть м’язові групи зі списку.',
      });
    }

    const equipmentSlugs = new Set(EQUIPMENT_OPTIONS.map((item) => item.slug));
    if (
      data.equipment.some(
        (item) => !equipmentSlugs.has(item as (typeof EQUIPMENT_OPTIONS)[number]['slug']),
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipment'],
        message: 'Оберіть обладнання зі списку.',
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
