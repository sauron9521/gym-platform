import type { operations } from '@gym/api-client';

import type { CreateTrainingProgramValues } from './create-training-program';

export type EditTrainingProgramDraftValues = CreateTrainingProgramValues;

export function toTrainingProgramDraftValues(version: {
  title: string;
  description: string | null;
  durationWeeks: number | null;
}): EditTrainingProgramDraftValues {
  return {
    title: version.title,
    description: version.description ?? '',
    durationWeeks: version.durationWeeks === null ? '' : String(version.durationWeeks),
  };
}

export type UpdateTrainingProgramDraftPayload =
  operations['TrainingProgramVersionsController_updateDraftVersion']['requestBody']['content']['application/json'];

export function buildUpdateTrainingProgramDraftPayload(
  values: EditTrainingProgramDraftValues,
): UpdateTrainingProgramDraftPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    durationWeeks: values.durationWeeks.trim() ? Number(values.durationWeeks) : null,
  };
}

export function getTrainingProgramDetailsError(status?: number): string {
  if (status === 403 || status === 404) return 'Програму не знайдено або немає доступу.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося завантажити програму. Перевірте з’єднання та повторіть спробу.';
}

export function getUpdateTrainingProgramDraftError(status?: number): string {
  if (status === 400) {
    return 'Некоректні дані або тривалість менша за запланований тренувальний тиждень.';
  }
  if (status === 403 || status === 404) return 'Немає доступу до редагування цієї програми.';
  if (status === 409) return 'Чернетку вже змінено, опубліковано або архівовано. Оновіть сторінку.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося зберегти зміни. Перевірте з’єднання та повторіть спробу.';
}
