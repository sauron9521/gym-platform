import { isDeepStrictEqual } from 'node:util';
import type { Prisma } from '#prisma/client';
import { outboxEventSchema, type OutboxEventInput } from '../domain/outbox-event.policy.js';

/**
 * Append within the caller's existing business transaction. A successful
 * return describes the transaction-local result, not a committed delivery.
 * The caller must propagate errors to roll back the business transition.
 */
export async function publishOutboxEvent(
  tx: Prisma.TransactionClient,
  input: OutboxEventInput,
): Promise<'inserted' | 'existing'> {
  const parsed = outboxEventSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid outbox event');
  const event = parsed.data;
  const eventKey = `mfa-lifecycle:${event.payload.aggregate.id}:v1`;
  // ON CONFLICT DO NOTHING avoids aborting the PostgreSQL transaction on
  // replay. Never overwrite a prior event or its processing state.
  const result = await tx.outboxEvent.createMany({
    data: { eventKey, ...event },
    skipDuplicates: true,
  });
  if (result.count === 1) return 'inserted';

  const existing = await tx.outboxEvent.findUnique({
    where: { eventKey },
    select: {
      type: true,
      schemaVersion: true,
      occurredAt: true,
      actorUserId: true,
      payload: true,
    },
  });
  // A key collision with different immutable data is not a successful
  // replay. Do not log event content, user IDs, or database errors.
  if (!existing || !isDeepStrictEqual(existing, event)) {
    throw new Error('Outbox event key conflict');
  }
  return 'existing';
}
