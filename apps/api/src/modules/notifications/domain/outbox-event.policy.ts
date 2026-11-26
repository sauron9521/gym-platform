import { z } from 'zod';

// The only event currently emitted. Add new types as explicit versioned
// variants with their own deterministic key and bounded routing payload.
const securityAction = z.enum([
  'FIRST_TOTP_CONFIRMED',
  'ADMIN_RECOVERY_CHALLENGE_VERIFIED',
  'ADMIN_RECOVERY_CODES_REGENERATED',
  'ADMIN_TOTP_REPLACEMENT_STAGED',
  'ADMIN_TOTP_REPLACEMENT_CONFIRMED',
]);

const accountSecurityEvent = z.strictObject({
  type: z.literal('account.security.changed'),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('MfaLifecycleAudit'), id: z.uuid() }),
    context: z.strictObject({ userId: z.uuid(), action: securityAction }),
  }),
});

export const outboxEventSchema = z
  .discriminatedUnion('type', [accountSecurityEvent])
  .refine((event) => event.actorUserId === event.payload.context.userId, {
    message: 'Event actor and account must match',
  });

export type OutboxEventInput = z.input<typeof outboxEventSchema>;
