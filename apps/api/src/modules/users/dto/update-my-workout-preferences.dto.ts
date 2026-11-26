import { restDurationPresets } from '@gym/domain';
import { z } from 'zod';

const restDuration = z.literal(restDurationPresets);

// A non-empty partial update, represented in both validation and OpenAPI.
export const updateMyWorkoutPreferencesSchema = z.union([
  z.strictObject({
    autoRestTimer: z.boolean(),
    restDurationSeconds: restDuration.optional(),
  }),
  z.strictObject({
    autoRestTimer: z.boolean().optional(),
    restDurationSeconds: restDuration,
  }),
]);

export type UpdateMyWorkoutPreferencesDto = z.infer<typeof updateMyWorkoutPreferencesSchema>;
