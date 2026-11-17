import { z } from 'zod';

/** Null clears the explicit preference and restores device/browser selection. */
export const updateMyPreferencesSchema = z.strictObject({
  preferredLocale: z.enum(['uk', 'en']).nullable(),
});

export type UpdateMyPreferencesDto = z.infer<typeof updateMyPreferencesSchema>;
