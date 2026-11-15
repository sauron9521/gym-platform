import type { operations } from '@gym/api-client';

import {
  addProgramSetSchema,
  type AddProgramSetValues,
  type SavedProgramSet,
} from './add-program-set.ts';

export type UpdateProgramSetPayload =
  operations['TrainingProgramSetsController_updateSet']['requestBody']['content']['application/json'];

export const editProgramSetSchema = addProgramSetSchema;
export type EditProgramSetValues = AddProgramSetValues;

/** All editable targets are sent on PATCH; blank values explicitly clear old values. */
export function buildUpdateProgramSetPayload(
  values: EditProgramSetValues,
): UpdateProgramSetPayload {
  return {
    setType: values.setType,
    plannedReps: values.plannedReps === '' ? null : Number(values.plannedReps),
    plannedWeightKg: values.plannedWeightKg === '' ? null : Number(values.plannedWeightKg),
    plannedDurationSeconds:
      values.plannedDurationSeconds === '' ? null : Number(values.plannedDurationSeconds),
    plannedDistanceMeters:
      values.plannedDistanceMeters === '' ? null : Number(values.plannedDistanceMeters),
    restSeconds: values.restSeconds === '' ? null : Number(values.restSeconds),
    targetRpe: values.targetRpe === '' ? null : Number(values.targetRpe),
    targetRir: values.targetRir === '' ? null : Number(values.targetRir),
    notes: values.notes.trim() || null,
  };
}

export function defaultEditProgramSetValues(set: SavedProgramSet): EditProgramSetValues {
  return {
    setType: set.setType,
    plannedReps: set.plannedReps === null ? '' : String(set.plannedReps),
    plannedWeightKg: set.plannedWeightKg ?? '',
    plannedDurationSeconds:
      set.plannedDurationSeconds === null ? '' : String(set.plannedDurationSeconds),
    plannedDistanceMeters: set.plannedDistanceMeters ?? '',
    restSeconds: set.restSeconds === null ? '' : String(set.restSeconds),
    targetRpe: set.targetRpe ?? '',
    targetRir: set.targetRir === null ? '' : String(set.targetRir),
    notes: set.notes ?? '',
  };
}

export function getProgramSetMutationError(
  action: 'edit' | 'delete',
  status?: number,
): string {
  if (status === 400) return 'Перевірте значення параметрів підходу.';
  if (status === 403 || status === 404) {
    return 'Немає доступу до підходу або чернетки.';
  }
  if (status === 409) {
    return 'Чернетка більше не редагується або змінилася. Оновіть сторінку.';
  }
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return action === 'edit'
    ? 'Не вдалося зберегти підхід. Спробуйте ще раз.'
    : 'Не вдалося видалити підхід. Спробуйте ще раз.';
}
