import type { operations } from '@gym/api-client';

import {
  buildCreateProgramWorkoutPayload,
  createProgramWorkoutSchema,
  type CreateProgramWorkoutValues,
  type ProgramVersionWithWorkouts,
} from './create-program-workout';

export type ProgramWorkout = ProgramVersionWithWorkouts['workouts'][number];

export type UpdateProgramWorkoutPayload =
  operations['TrainingProgramWorkoutsController_updateWorkout']['requestBody']['content']['application/json'];

export const editProgramWorkoutSchema = createProgramWorkoutSchema;
export type EditProgramWorkoutValues = CreateProgramWorkoutValues;

export function buildUpdateProgramWorkoutPayload(
  values: EditProgramWorkoutValues,
): UpdateProgramWorkoutPayload {
  const base = buildCreateProgramWorkoutPayload(values);
  return {
    weekNumber: base.weekNumber,
    dayNumber: base.dayNumber,
    title: base.title,
    // PATCH requires null to remove existing notes; omitting the property leaves them unchanged.
    notes: values.notes.trim() || null,
  };
}

export function getProgramWorkoutMutationError(action: 'edit' | 'delete', status?: number): string {
  if (status === 400) return 'Перевірте дані тренувального дня.';
  if (status === 403 || status === 404) {
    return 'Тренувальний день не знайдено або немає доступу.';
  }
  if (status === 409) {
    return 'День уже зайнятий або чернетка більше не редагується. Оновіть сторінку.';
  }
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return action === 'edit'
    ? 'Не вдалося зберегти тренувальний день. Спробуйте ще раз.'
    : 'Не вдалося видалити тренувальний день. Спробуйте ще раз.';
}
