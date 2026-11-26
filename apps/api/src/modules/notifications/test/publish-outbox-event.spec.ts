import { randomUUID } from 'node:crypto';
import type { Prisma } from '#prisma/client';
import { publishOutboxEvent, type OutboxEventInput } from '../public-api.js';

function input(): OutboxEventInput {
  const userId = randomUUID();
  return {
    type: 'account.security.changed',
    schemaVersion: 1,
    occurredAt: new Date(),
    actorUserId: userId,
    payload: {
      aggregate: { kind: 'MfaLifecycleAudit', id: randomUUID() },
      context: { userId, action: 'FIRST_TOTP_CONFIRMED' },
    },
  };
}

describe('publishOutboxEvent', () => {
  it.each([
    (e: OutboxEventInput) => ({ ...e, schemaVersion: 2 }),
    (e: OutboxEventInput) => ({ ...e, type: 'unknown' }),
    (e: OutboxEventInput) => ({ ...e, actorUserId: randomUUID() }),
    (e: OutboxEventInput) => ({ ...e, occurredAt: new Date(NaN) }),
    (e: OutboxEventInput) => ({ ...e, payload: { ...e.payload, secret: 'private-proof' } }),
    (e: OutboxEventInput) => ({
      ...e,
      payload: {
        ...e.payload,
        context: { ...e.payload.context, action: 'ADMIN_TOTP_CHALLENGE_VERIFIED' },
      },
    }),
  ])('rejects invalid or excessive payload before persistence', async (mutate) => {
    const createMany = vi.fn();
    const tx = { outboxEvent: { createMany } } as unknown as Prisma.TransactionClient;
    await expect(publishOutboxEvent(tx, mutate(input()) as OutboxEventInput)).rejects.toThrow(
      'Invalid outbox event',
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});
