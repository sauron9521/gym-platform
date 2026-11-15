import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type CreateProgramWorkoutPayload =
  operations['TrainingProgramWorkoutsController_createWorkout']['requestBody']['content']['application/json'];

export type ProgramVersionWithWorkouts =
  operations['TrainingProgramVersionsController_findVersion']['responses'][200]['content']['application/json'];

const numberField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `Вкажіть ціле число для поля «${label}».`)
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      message: `Вкажіть число від ${min} до ${max}.`,
    });

export const createProgramWorkoutSchema = z.object({
  weekNumber: numberField(1, 52, 'Тиждень'),
  dayNumber: numberField(1, 7, 'День'),
  title: z.string().trim().min(2, 'Мінімум 2 символи.').max(120, 'Максимум 120 символів.'),
  notes: z.string().trim().max(5000, 'Максимум 5000 символів.'),
});

export type CreateProgramWorkoutValues = z.infer<typeof createProgramWorkoutSchema>;

export function buildCreateProgramWorkoutPayload(
  values: CreateProgramWorkoutValues,
): CreateProgramWorkoutPayload {
  return {
    weekNumber: Number(values.weekNumber),
    dayNumber: Number(values.dayNumber),
    title: values.title.trim(),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };
}

export function isWeekWithinDuration(weekNumber: number, durationWeeks: number | null): boolean {
  return durationWeeks === null || weekNumber <= durationWeeks;
}

export function sortProgramWorkouts(
  workouts: ProgramVersionWithWorkouts['workouts'],
): ProgramVersionWithWorkouts['workouts'] {
  return [...workouts].sort(
    (first, second) =>
      first.weekNumber - second.weekNumber || first.dayNumber - second.dayNumber,
  );
}

export function getCreateProgramWorkoutError(status?: number): string {
  if (status === 400) return 'Перевірте дані: тиждень не може перевищувати тривалість програми.';
  if (status === 403 || status === 404) return 'Немає доступу до цієї чернетки.';
  if (status === 409) return 'Цей день уже існує або чернетка більше не редагується.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося додати тренувальний день. Спробуйте ще раз.';
}

export function getProgramWorkoutsLoadError(status?: number): string {
  if (status === 403 || status === 404) return 'Версію програми не знайдено або немає доступу.';
  if (status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  return 'Не вдалося завантажити тренувальні дні. Спробуйте ще раз.';
}
