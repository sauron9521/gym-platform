import type { WorkoutDetailsData } from './workout-details';

export type WorkoutAction = 'start' | 'complete' | 'cancel';

export function canCompleteWorkout(workout: WorkoutDetailsData): boolean {
  if (workout.status !== 'IN_PROGRESS') return false;
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  return (
    sets.length > 0 &&
    sets.every((set) => set.status !== 'PENDING') &&
    sets.some((set) => set.status === 'COMPLETED')
  );
}

export function availableWorkoutActions(workout: WorkoutDetailsData): WorkoutAction[] {
  switch (workout.status) {
    case 'PLANNED':
      return ['start', 'cancel'];
    case 'IN_PROGRESS':
      return canCompleteWorkout(workout) ? ['complete', 'cancel'] : ['cancel'];
    default:
      return [];
  }
}

export function getWorkoutActionErrorMessage(status?: number): string {
  if (status === 400 || status === 409) {
    return 'Стан тренування змінився або дія недоступна. Оновіть дані та спробуйте ще раз.';
  }
  if (status === 403 || status === 404) {
    return 'Тренування не знайдено або немає доступу.';
  }
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося виконати дію. Перевірте стан тренування та спробуйте ще раз.';
}

export const WORKOUT_ACTION_LABELS: Record<WorkoutAction, string> = {
  start: 'Розпочати тренування',
  complete: 'Завершити тренування',
  cancel: 'Скасувати тренування',
};
