import type { operations } from '@gym/api-client';
import { z } from 'zod';

import type { WorkoutDetailsData } from './workout-details';

export type WorkoutEditPayload =
  operations['WorkoutsController_update']['requestBody']['content']['application/json'];

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isValidLocalDateTime(value: string): boolean {
  if (value === '') return true;
  const parts = localDateTimePattern.exec(value);
  if (!parts) return false;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;

  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ].every((part, index) => part === Number(parts[index + 1]));
}

export const editWorkoutSchema = z.object({
  title: z.string().trim().min(2, 'Мінімум 2 символи.').max(120, 'Максимум 120 символів.'),
  notes: z.string().trim().max(5000, 'Максимум 5000 символів.'),
  scheduledAt: z.string().refine(isValidLocalDateTime, 'Вкажіть коректну дату і час.'),
});

export type EditWorkoutValues = z.infer<typeof editWorkoutSchema>;
export type EditWorkoutChanges = Partial<Record<keyof EditWorkoutValues, boolean>>;

export function formatLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

export function getWorkoutEditDefaults(workout: WorkoutDetailsData): EditWorkoutValues {
  return {
    title: workout.title,
    notes: workout.notes ?? '',
    scheduledAt: formatLocalDateTime(workout.scheduledAt),
  };
}

export function buildWorkoutEditPayload(
  values: EditWorkoutValues,
  changes: EditWorkoutChanges,
): WorkoutEditPayload {
  const payload: WorkoutEditPayload = {};

  if (changes.title) payload.title = values.title.trim();
  if (changes.notes) payload.notes = values.notes.trim() || null;
  if (changes.scheduledAt) {
    payload.scheduledAt = values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null;
  }

  return payload;
}

export function getWorkoutEditErrorMessage(status?: number): string {
  if (status === 400 || status === 409) {
    return 'Тренування вже змінило стан або дані застаріли. Оновіть сторінку та спробуйте ще раз.';
  }
  if (status === 403 || status === 404) {
    return 'Тренування не знайдено або у вас немає доступу.';
  }
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося зберегти тренування. Перевірте з’єднання та спробуйте ще раз.';
}
