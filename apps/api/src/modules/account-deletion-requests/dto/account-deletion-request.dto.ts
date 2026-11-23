import { z } from 'zod';

export const accountDeletionRequestSchema = z.strictObject({
  confirm: z.literal(true),
  password: z.string().min(1).regex(/\S/).meta({ writeOnly: true }),
  totpCode: z
    .string()
    .regex(/^[0-9]{6}$/)
    .meta({ writeOnly: true })
    .optional(),
});

export type AccountDeletionRequestInput = z.infer<typeof accountDeletionRequestSchema>;
