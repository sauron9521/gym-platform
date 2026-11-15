import type { operations } from '@gym/api-client';

import type { SavedProgramSet } from './add-program-set.ts';

export type ReorderProgramSetsPayload =
  operations['TrainingProgramSetsController_reorderSets']['requestBody']['content']['application/json'];

export type SetMoveDirection = 'up' | 'down';

export function sortProgramSets(sets: readonly SavedProgramSet[]): SavedProgramSet[] {
  return [...sets].sort(
    (first, second) => first.setNumber - second.setNumber || first.id.localeCompare(second.id),
  );
}

/**
 * The API requires an exact permutation of all current set IDs. Keep IDs stable,
 * send the full ordering, and let the server assign the new setNumber values.
 */
export function buildReorderProgramSetsPayload(
  sets: readonly SavedProgramSet[],
  setId: string,
  direction: SetMoveDirection,
): ReorderProgramSetsPayload | null {
  if (sets.length < 2 || sets.length > 100) return null;

  const ordered = sortProgramSets(sets);
  const setIds = ordered.map((set) => set.id);
  if (new Set(setIds).size !== setIds.length) return null;

  const position = setIds.indexOf(setId);
  const target = position + (direction === 'up' ? -1 : 1);
  if (position < 0 || target < 0 || target >= setIds.length) return null;

  [setIds[position], setIds[target]] = [setIds[target]!, setIds[position]!];
  return { setIds };
}

export function getReorderProgramSetsError(status?: number): string {
  if (status === 400) return 'Порядок підходів змінився. Оновіть сторінку й повторіть дію.';
  if (status === 403 || status === 404) {
    return 'Немає доступу до вправи або чернетки програми.';
  }
  if (status === 409) return 'Чернетка більше не редагується. Оновіть сторінку.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося змінити порядок підходів. Спробуйте ще раз.';
}
