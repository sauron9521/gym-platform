import type { operations } from '@gym/api-client';

type WorkoutsQuery = NonNullable<operations['WorkoutsController_findMany']['parameters']['query']>;
type WorkoutsResponse =
  operations['WorkoutsController_findMany']['responses'][200]['content']['application/json'];

export type WorkoutStatus = NonNullable<WorkoutsQuery['status']>;
export type WorkoutFilter = 'ALL' | WorkoutStatus;
export type WorkoutListItem = WorkoutsResponse['data'][number];

export const WORKOUT_FILTERS: ReadonlyArray<{ value: WorkoutFilter; label: string }> = [
  { value: 'ALL', label: 'Усі тренування' },
  { value: 'PLANNED', label: 'Заплановані' },
  { value: 'IN_PROGRESS', label: 'У процесі' },
  { value: 'COMPLETED', label: 'Завершені' },
  { value: 'CANCELLED', label: 'Скасовані' },
];

const workoutStatuses: Record<WorkoutStatus, string> = {
  PLANNED: 'Заплановано',
  IN_PROGRESS: 'У процесі',
  COMPLETED: 'Завершено',
  CANCELLED: 'Скасовано',
};

export function getWorkoutStatusLabel(status: WorkoutStatus): string {
  return workoutStatuses[status];
}

export function getWorkoutListErrorMessage(status?: number): string {
  if (status === 403) return 'Немає дозволу переглядати ці тренування.';
  if (status === 400) return 'Некоректні параметри пошуку тренувань.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося завантажити тренування. Спробуйте ще раз.';
}

export function formatWorkoutDate(value: string | null): string {
  if (!value) return 'Не заплановано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата недоступна';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getWorkoutPageCount(totalPages: number): number {
  return Number.isSafeInteger(totalPages) && totalPages > 0 ? totalPages : 1;
}
