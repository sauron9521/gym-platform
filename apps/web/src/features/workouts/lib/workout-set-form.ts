import type { operations } from '@gym/api-client';
import { z } from 'zod';

import type { WorkoutDetailsData } from './workout-details';

export type WorkoutSetData = WorkoutDetailsData['exercises'][number]['sets'][number];
export type WorkoutSetPayload = NonNullable<
  operations['WorkoutsController_updateSet']['requestBody']
>['content']['application/json'];

const numericText = (min: number, max: number, decimals: number, integer = false) =>
  z.string().trim().superRefine((value, ctx) => {
    if (value === '') return;
    const pattern = integer ? /^\d+$/ : /^\d+(?:[.,]\d+)?$/;
    const number = Number(value.replace(',', '.'));
    if (
      !pattern.test(value) ||
      !Number.isFinite(number) ||
      number < min ||
      number > max ||
      Math.abs(number * 10 ** decimals - Math.round(number * 10 ** decimals)) > 1e-6
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `Введіть число від ${min} до ${max} (до ${decimals} знаків після коми).`,
      });
    }
  });

export const workoutSetFormSchema = z.object({
  actualReps: numericText(1, 1000, 0, true),
  actualWeightKg: numericText(0, 999999.99, 2),
  actualDurationSeconds: numericText(1, 604800, 0, true),
  actualDistanceMeters: numericText(0, 99999999.99, 2),
  restSeconds: numericText(0, 86400, 0, true),
  rpe: numericText(1, 10, 1),
  rir: numericText(0, 10, 0, true),
  notes: z.string().trim().max(5000, 'Максимум 5000 символів.'),
});

export type WorkoutSetFormValues = z.infer<typeof workoutSetFormSchema>;

const asText = (value: number | string | null): string =>
  value === null ? '' : String(value);

export function getWorkoutSetDefaults(set: WorkoutSetData): WorkoutSetFormValues {
  return {
    actualReps: asText(set.actualReps),
    actualWeightKg: asText(set.actualWeightKg),
    actualDurationSeconds: asText(set.actualDurationSeconds),
    actualDistanceMeters: asText(set.actualDistanceMeters),
    restSeconds: asText(set.restSeconds),
    rpe: asText(set.rpe),
    rir: asText(set.rir),
    notes: set.notes ?? '',
  };
}

const asNumber = (value: string): number | null =>
  value === '' ? null : Number(value.replace(',', '.'));

export function buildWorkoutSetPayload(
  status: 'COMPLETED' | 'SKIPPED',
  values: WorkoutSetFormValues,
): WorkoutSetPayload {
  if (status === 'SKIPPED') return { status };
  return {
    status,
    actualReps: asNumber(values.actualReps),
    actualWeightKg: asNumber(values.actualWeightKg),
    actualDurationSeconds: asNumber(values.actualDurationSeconds),
    actualDistanceMeters: asNumber(values.actualDistanceMeters),
    restSeconds: asNumber(values.restSeconds),
    rpe: asNumber(values.rpe),
    rir: asNumber(values.rir),
    notes: values.notes.trim() || null,
  };
}

export function getWorkoutSetSubmitError(status?: number): string {
  if (status === 400 || status === 409) {
    return 'Дані підходу або стан тренування змінилися. Оновіть тренування та спробуйте ще раз.';
  }
  if (status === 403 || status === 404) return 'Підхід не знайдено або немає доступу.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося зберегти підхід. Перевірте з’єднання та спробуйте ще раз.';
}
