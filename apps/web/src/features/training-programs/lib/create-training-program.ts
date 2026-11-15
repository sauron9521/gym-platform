import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type CreateTrainingProgramPayload =
  operations['TrainingProgramsController_create']['requestBody']['content']['application/json'];

const durationWeeksSchema = z.string().trim().refine(
  (value) => {
    if (value === '') return true;
    if (!/^\d+$/.test(value)) return false;
    const weeks = Number(value);
    return weeks >= 1 && weeks <= 52;
  },
  'Вкажіть ціле число від 1 до 52 або залиште поле порожнім.',
);

export const createTrainingProgramFormSchema = z.object({
  title: z.string().trim().min(2, 'Мінімум 2 символи.').max(120, 'Максимум 120 символів.'),
  description: z.string().trim().max(5000, 'Максимум 5000 символів.'),
  durationWeeks: durationWeeksSchema,
});

export type CreateTrainingProgramValues = z.infer<typeof createTrainingProgramFormSchema>;

export function buildCreateTrainingProgramPayload(
  values: CreateTrainingProgramValues,
): CreateTrainingProgramPayload {
  return {
    title: values.title.trim(),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(values.durationWeeks.trim() ? { durationWeeks: Number(values.durationWeeks) } : {}),
  };
}

export function getCreateTrainingProgramErrorMessage(status?: number): string {
  if (status === 400) return 'Перевірте назву, опис і тривалість програми.';
  if (status === 403) return 'Створювати програми можуть лише тренери.';
  if (status === 409) return 'Конфлікт під час створення програми. Оновіть список.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося створити програму. Перевірте з’єднання та спробуйте ще раз.';
}
