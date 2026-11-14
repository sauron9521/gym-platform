import type { operations } from '@gym/api-client';

type ExerciseListResponse =
  operations['ExercisesController_findMany']['responses'][200]['content']['application/json'];
type ExerciseQuery = NonNullable<operations['ExercisesController_findMany']['parameters']['query']>;

export type ExerciseListItem = ExerciseListResponse['data'][number];
export type ExerciseDetailsData =
  operations['ExercisesController_findOne']['responses'][200]['content']['application/json'];
export type ExerciseType = NonNullable<ExerciseQuery['exerciseType']>;
export type ExerciseTypeFilter = ExerciseType | 'ALL';

export const EXERCISE_TYPES: ReadonlyArray<{ value: ExerciseTypeFilter; label: string }> = [
  { value: 'ALL', label: 'Усі типи' },
  { value: 'STRENGTH', label: 'Силові' },
  { value: 'CARDIO', label: 'Кардіо' },
  { value: 'MOBILITY', label: 'Мобільність' },
  { value: 'PLYOMETRIC', label: 'Пліометрика' },
  { value: 'OTHER', label: 'Інші' },
];

const exerciseSources: Record<ExerciseListItem['source'], string> = {
  GLOBAL: 'Загальна бібліотека',
  ATHLETE_CUSTOM: 'Власна вправа атлета',
  TRAINER_CUSTOM: 'Вправа тренера',
};

const exerciseTypes: Record<ExerciseType, string> = {
  STRENGTH: 'Силова',
  CARDIO: 'Кардіо',
  MOBILITY: 'Мобільність',
  PLYOMETRIC: 'Пліометрика',
  OTHER: 'Інша',
};

export function getExerciseTypeLabel(value: ExerciseType): string {
  return exerciseTypes[value];
}

export function getExerciseSourceLabel(value: ExerciseListItem['source']): string {
  return exerciseSources[value];
}

export function getExerciseErrorMessage(status?: number): string {
  if (status === 400) return 'Некоректні параметри пошуку вправ.';
  if (status === 403) return 'Немає доступу до вправ.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося завантажити каталог вправ. Спробуйте ще раз.';
}

export function getExerciseDetailsErrorMessage(status?: number): string {
  if (status === 400) return 'Некоректний ідентифікатор вправи.';
  if (status === 403 || status === 404) return 'Вправу не знайдено або немає доступу.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося завантажити вправу. Спробуйте ще раз.';
}

export function getExercisePageCount(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
