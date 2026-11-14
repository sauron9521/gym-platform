import type { operations } from '@gym/api-client';

import type { AuthenticatedUser } from '@/shared/api/server-session';
import {
  createExerciseFormSchema,
  type CreateExerciseValues,
  type CustomExerciseActorRole,
} from './create-exercise';
import type { ExerciseDetailsData } from './exercise-catalog';

export type UpdateExercisePayload =
  operations['ExercisesController_update']['requestBody']['content']['application/json'];
export type EditExerciseValues = CreateExerciseValues;

export function canManageCustomExercise(
  exercise: ExerciseDetailsData,
  actor: Pick<AuthenticatedUser, 'id' | 'role'>,
): boolean {
  if (exercise.isArchived || exercise.createdById !== actor.id) return false;
  return (
    (actor.role === 'ATHLETE' && exercise.source === 'ATHLETE_CUSTOM') ||
    (actor.role === 'TRAINER' && exercise.source === 'TRAINER_CUSTOM')
  );
}

export const editExerciseSchema = createExerciseFormSchema;

export function getEditExerciseDefaults(exercise: ExerciseDetailsData): EditExerciseValues {
  return {
    name: exercise.name,
    description: exercise.description ?? '',
    instructions: exercise.instructions ?? '',
    exerciseType: exercise.exerciseType,
    visibility: exercise.visibility ?? 'PRIVATE',
    muscleGroups: exercise.muscleGroups.map((item) => ({
      slug: item.muscleGroup.slug,
      role: item.role,
    })),
    equipment: exercise.equipment.map((item) => item.equipment.slug),
  };
}

export function buildUpdateExercisePayload(
  values: EditExerciseValues,
  exercise: ExerciseDetailsData,
  role: CustomExerciseActorRole,
): UpdateExercisePayload {
  const previous = getEditExerciseDefaults(exercise);
  const body: UpdateExercisePayload = {};

  if (values.name.trim() !== previous.name) body.name = values.name.trim();
  if (values.description.trim() !== previous.description) {
    body.description = values.description.trim() || null;
  }
  if (values.instructions.trim() !== previous.instructions) {
    body.instructions = values.instructions.trim() || null;
  }
  if (values.exerciseType !== previous.exerciseType) body.exerciseType = values.exerciseType;
  if (role === 'ATHLETE' && values.visibility !== previous.visibility) {
    body.visibility = values.visibility;
  }
  if (JSON.stringify(values.muscleGroups) !== JSON.stringify(previous.muscleGroups)) {
    body.muscleGroups = values.muscleGroups.map((item) => ({
      slug: item.slug,
      role: item.role,
    }));
  }
  if (JSON.stringify(values.equipment) !== JSON.stringify(previous.equipment)) {
    body.equipment = values.equipment;
  }
  return body;
}

export function getExerciseMutationErrorMessage(status?: number): string {
  if (status === 400) {
    return 'Перевірте поля та довідники м’язів і обладнання. Оновіть дані й спробуйте ще раз.';
  }
  if (status === 403 || status === 404) {
    return 'Вправа недоступна або немає прав на її зміну.';
  }
  if (status === 409) return 'Вправа вже змінилася. Оновіть дані й спробуйте ще раз.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося зберегти зміни. Перевірте стан вправи перед повторенням.';
}
