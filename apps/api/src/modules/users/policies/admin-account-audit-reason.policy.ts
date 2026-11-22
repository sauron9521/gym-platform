import { z } from 'zod';

/**
 * Machine-readable reasons only: free-form text can leak PII or secrets into
 * a durable audit trail. Detailed ticket/case attribution needs a separately
 * reviewed retention and access policy before it can be introduced.
 */
export const adminAccountStatusReasonSchema = z.enum([
  'SECURITY',
  'POLICY',
  'USER_REQUEST',
  'ERROR_CORRECTION',
]);

export type AdminAccountStatusReasonCode = z.infer<typeof adminAccountStatusReasonSchema>;
