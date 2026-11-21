import { z } from 'zod';

import { trainingProgramAssignmentStatusSchema } from './training-program.schemas.js';

export const queryTrainingProgramAssignmentsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: trainingProgramAssignmentStatusSchema.optional(),
  // Trainer-owned, currently ACTIVE relationship filter (SQL scoped before pagination).
  trainerAthleteId: z.string().uuid().optional(),
  view: z.enum(['full', 'summary']).optional(),
});

export type QueryTrainingProgramAssignmentsDto = z.infer<
  typeof queryTrainingProgramAssignmentsSchema
>;
