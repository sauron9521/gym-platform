import { z } from 'zod';

import { ACCOUNT_STATUSES } from '../policies/admin-account-status.policy.js';

/**
 * Contract only. No HTTP mutation endpoint is enabled by this schema.
 * Never log the reason as raw request data.
 */
export const adminAccountStatusTargetSchema = z.uuid();

export const adminAccountStatusCommandSchema = z.strictObject({
  expectedStatus: z.enum(ACCOUNT_STATUSES),
  reason: z
    .string()
    .trim()
    .min(8)
    .max(500)
    .refine(
      (reason) =>
        Array.from(reason).every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && (code < 127 || code > 159);
        }),
      'Reason must not contain control characters',
    ),
});
