import { z } from 'zod';

import { trainerAthleteStatusSchema } from './trainer-athlete.schemas.js';

export const queryTrainerAthletesSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: trainerAthleteStatusSchema.optional(),
  // Limit trainer dashboard pagination to collaborations owned as trainer.
  scope: z.enum(['trainer']).optional(),
});

export type QueryTrainerAthletesDto = z.infer<typeof queryTrainerAthletesSchema>;
