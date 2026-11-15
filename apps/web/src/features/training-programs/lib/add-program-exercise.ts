import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type ProgramExerciseOption =
  operations['ExercisesController_findMany']['responses'][200]['content']['application/json']['data'][number];

export type AddProgramExercisePayload =
  operations['TrainingProgramExercisesController_addExercise']['requestBody']['content']['application/json'];

export const addProgramExerciseSchema = z.object({
  exerciseId: z.uuid('Оберіть вправу з каталогу.'),
  notes: z.string().trim().max(5000, 'Максимум 5000 символів.'),
});

export type AddProgramExerciseValues = z.infer<typeof addProgramExerciseSchema>;

export function buildAddProgramExercisePayload(
  values: AddProgramExerciseValues,
): AddProgramExercisePayload {
  return {
    exerciseId: values.exerciseId,
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };
}

export function isProgramExerciseSelectable(
  exercise: ProgramExerciseOption,
  existingIds: readonly string[],
): boolean {
  return (
    !exercise.isArchived &&
    (exercise.source === 'GLOBAL' || exercise.source === 'TRAINER_CUSTOM') &&
    !existingIds.includes(exercise.id)
  );
}

export function getAddProgramExerciseError(status?: number): string {
  if (status === 400) return 'Перевірте вибрану вправу та примітки.';
  if (status === 401) return 'Увійдіть в акаунт ще раз.';
  if (status === 403 || status === 404) {
    return 'Немає доступу до вправи або чернетки програми.';
  }
  if (status === 409) return 'Чернетка змінилася. Оновіть сторінку і повторіть дію.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося додати вправу. Спробуйте ще раз.';
}

export function getProgramExerciseListError(status?: number): string {
  if (status === 429) return 'Забагато запитів до каталогу. Спробуйте пізніше.';
  return 'Не вдалося завантажити каталог вправ.';
}
