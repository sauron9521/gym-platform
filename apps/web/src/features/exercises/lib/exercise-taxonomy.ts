import type { operations } from '@gym/api-client';

export type ExerciseTaxonomyItem =
  operations['ExercisesController_listMuscleGroups']['responses'][200]['content']['application/json'][number];

export type ExerciseTaxonomyState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      muscleGroups: ExerciseTaxonomyItem[];
      equipment: ExerciseTaxonomyItem[];
    };

export function getTaxonomyErrorMessage(status?: number): string {
  if (status === 429) return 'Забагато запитів до довідників. Спробуйте пізніше.';
  return 'Не вдалося завантажити довідники м’язів та обладнання. Спробуйте ще раз.';
}
