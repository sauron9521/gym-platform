export type WorkoutState = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export function workoutStatusLabel(value: WorkoutState): string {
  switch (value) {
    case 'PLANNED':
      return 'Заплановано';
    case 'IN_PROGRESS':
      return 'Триває';
    case 'COMPLETED':
      return 'Завершено';
    case 'CANCELLED':
      return 'Скасовано';
  }
}
