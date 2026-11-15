import type { operations } from '@gym/api-client';
import { z } from 'zod';

export type AddProgramSetPayload =
  operations['TrainingProgramSetsController_addSet']['requestBody']['content']['application/json'];

export const programSetTypes = ['WARMUP', 'WORKING', 'DROP_SET', 'AMRAP'] as const;

export const programSetTypeLabels: Record<(typeof programSetTypes)[number], string> = {
  WARMUP: 'Розминка',
  WORKING: 'Робочий',
  DROP_SET: 'Дроп-сет',
  AMRAP: 'До відмови',
};

function optionalNumber(
  label: string,
  min: number,
  max: number,
  decimals: number,
) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (decimals === 0
          ? /^\d+$/.test(value)
          : decimals === 1
            ? /^\d+(?:\.\d)?$/.test(value)
            : /^\d+(?:\.\d{1,2})?$/.test(value)),
      `Невірний формат поля «${label}».`,
    )
    .refine(
      (value) => value === '' || (Number(value) >= min && Number(value) <= max),
      `«${label}»: число від ${min} до ${max}.`,
    );
}

export const addProgramSetSchema = z.object({
  setType: z.enum(programSetTypes),
  plannedReps: optionalNumber('Повторення', 1, 1000, 0),
  plannedWeightKg: optionalNumber('Вага', 0, 999999.99, 2),
  plannedDurationSeconds: optionalNumber('Тривалість', 1, 604800, 0),
  plannedDistanceMeters: optionalNumber('Дистанція', 0, 99999999.99, 2),
  restSeconds: optionalNumber('Відпочинок', 0, 86400, 0),
  targetRpe: optionalNumber('RPE', 1, 10, 1),
  targetRir: optionalNumber('RIR', 0, 10, 0),
  notes: z.string().trim().max(5000, 'Максимум 5000 символів.'),
});

export type AddProgramSetValues = z.infer<typeof addProgramSetSchema>;

export const defaultProgramSetValues: AddProgramSetValues = {
  setType: 'WORKING',
  plannedReps: '',
  plannedWeightKg: '',
  plannedDurationSeconds: '',
  plannedDistanceMeters: '',
  restSeconds: '',
  targetRpe: '',
  targetRir: '',
  notes: '',
};

const numericFields = [
  'plannedReps',
  'plannedWeightKg',
  'plannedDurationSeconds',
  'plannedDistanceMeters',
  'restSeconds',
  'targetRpe',
  'targetRir',
] as const;

export function buildAddProgramSetPayload(values: AddProgramSetValues): AddProgramSetPayload {
  const payload: AddProgramSetPayload = { setType: values.setType };
  for (const field of numericFields) {
    if (values[field] !== '') payload[field] = Number(values[field]);
  }
  if (values.notes.trim()) payload.notes = values.notes.trim();
  return payload;
}

export function getAddProgramSetError(status?: number): string {
  if (status === 400) return 'Перевірте значення підходу.';
  if (status === 403 || status === 404) {
    return 'Немає доступу до цієї вправи або чернетки.';
  }
  if (status === 409) return 'Чернетка змінилася або підхід уже існує. Оновіть сторінку.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося додати підхід. Спробуйте ще раз.';
}

export type SavedProgramSet =
  operations['TrainingProgramVersionsController_findVersion']['responses'][200]['content']['application/json']['workouts'][number]['exercises'][number]['sets'][number];

export function describeProgramSet(set: SavedProgramSet): string {
  const parts: string[] = [programSetTypeLabels[set.setType]];
  if (set.plannedReps !== null) parts.push(`${set.plannedReps} повт.`);
  if (set.plannedWeightKg !== null) parts.push(`${set.plannedWeightKg} кг`);
  if (set.plannedDurationSeconds !== null) parts.push(`${set.plannedDurationSeconds} с`);
  if (set.plannedDistanceMeters !== null) parts.push(`${set.plannedDistanceMeters} м`);
  if (set.restSeconds !== null) parts.push(`відпочинок ${set.restSeconds} с`);
  if (set.targetRpe !== null) parts.push(`RPE ${set.targetRpe}`);
  if (set.targetRir !== null) parts.push(`RIR ${set.targetRir}`);
  return parts.join(' · ');
}
