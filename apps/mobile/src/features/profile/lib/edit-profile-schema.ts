import { z } from 'zod';

export const editProfileSchema = z.object({
  displayName: z.string().trim().max(100, 'Не більше 100 символів.'),
  firstName: z.string().trim().max(100, 'Не більше 100 символів.'),
  lastName: z.string().trim().max(100, 'Не більше 100 символів.'),
  height: z
    .string()
    .trim()
    .refine(
      (value) => !value || (/^\d+$/.test(value) && Number(value) >= 50 && Number(value) <= 300),
      'Зріст має бути 50–300 см.',
    ),
  weight: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        (/^\d+(?:[.,]\d{0,2})?$/.test(value) &&
          Number(value.replace(',', '.')) >= 1 &&
          Number(value.replace(',', '.')) <= 600),
      'Вага має бути 1–600 кг.',
    ),
});

export type EditProfileValues = z.infer<typeof editProfileSchema>;

export function profilePatch(values: EditProfileValues) {
  return {
    displayName: values.displayName || null,
    firstName: values.firstName || null,
    lastName: values.lastName || null,
    height: values.height ? Number(values.height) : null,
    weight: values.weight ? Number(values.weight.replace(',', '.')) : null,
  };
}
