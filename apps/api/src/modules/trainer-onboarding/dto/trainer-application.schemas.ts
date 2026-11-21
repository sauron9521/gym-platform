import { z } from 'zod';

/**
 * Only applicant-written text. Status, role, reviewer, userId and all
 * moderation metadata are deliberately not writable through these routes.
 */
export const trainerApplicationInputSchema = z.strictObject({
  applicantNote: z.string().trim().min(20).max(1000),
});

export type TrainerApplicationInput = z.infer<typeof trainerApplicationInputSchema>;
