import type { operations } from '@gym/api-client';

export type WorkoutDetailsData =
  operations['WorkoutsController_findOne']['responses'][200]['content']['application/json'];

type WorkoutSet = WorkoutDetailsData['exercises'][number]['sets'][number];

export function getWorkoutDetailsErrorMessage(status?: number): string {
  if (status === 403 || status === 404) return 'Тренування не знайдено або немає доступу.';
  if (status === 400) return 'Некоректний ідентифікатор тренування.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося завантажити тренування. Спробуйте ще раз.';
}

export function getWorkoutSetStatusLabel(status: WorkoutSet['status']): string {
  const labels: Record<WorkoutSet['status'], string> = {
    PENDING: 'Очікує',
    COMPLETED: 'Виконано',
    SKIPPED: 'Пропущено',
  };
  return labels[status];
}

export function getWorkoutSetTypeLabel(type: WorkoutSet['setType']): string {
  const labels: Record<WorkoutSet['setType'], string> = {
    WARMUP: 'Розминка',
    WORKING: 'Робочий',
    DROP_SET: 'Дроп-сет',
    AMRAP: 'До відмови',
  };
  return labels[type];
}

export function formatWorkoutValue(value: number | string | null, suffix = ''): string {
  if (value === null) return '—';
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 }).format(amount) + suffix;
}
