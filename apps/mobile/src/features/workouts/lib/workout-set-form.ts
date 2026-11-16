import { z } from 'zod';

// TextInput values remain strings until validation; convert only before HTTP.
export const workoutSetFormSchema = z.object({
  actualReps: z
    .string()
    .trim()
    .regex(/^\\d*$/, 'Повторення мають бути цілим невід’ємним числом.')
    .refine((value) => !value || Number(value) <= 1000, 'Занадто багато повторень.'),
  actualWeightKg: z
    .string()
    .trim()
    .regex(/^\\d*(?:[.,]\\d{0,2})?$/, 'Вага має бути невід’ємним числом (до 2 знаків).')
    .refine((value) => !value || Number(value.replace(',', '.')) <= 10000, 'Надто велика вага.'),
});

export type WorkoutSetFormValues = z.infer<typeof workoutSetFormSchema>;

export function workoutSetPayload(values: WorkoutSetFormValues) {
  return {
    status: 'COMPLETED' as const,
    actualReps: values.actualReps === '' ? null : Number(values.actualReps),
    actualWeightKg:
      values.actualWeightKg === '' ? null : Number(values.actualWeightKg.replace(',', '.')),
  };
}
