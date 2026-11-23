import { z } from 'zod';

export const queryPublishedTrainingProgramVersionsSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  beforeVersion: z.coerce
    .number()
    .int()
    .min(1)
    .max(2_147_483_647)
    .describe('Exclusive version number returned as nextBeforeVersion on the previous page.')
    .optional(),
});

export type QueryPublishedTrainingProgramVersionsDto = z.infer<
  typeof queryPublishedTrainingProgramVersionsSchema
>;
