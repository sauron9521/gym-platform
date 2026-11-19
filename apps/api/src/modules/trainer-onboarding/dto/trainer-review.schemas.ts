import { z } from 'zod';

export const trainerReviewApplicationIdSchema = z.uuid();

export const trainerReviewDecisionSchema = z.strictObject({
  reason: z.string().trim().min(8).max(500),
});

export type TrainerReviewDecision = z.infer<typeof trainerReviewDecisionSchema>;
