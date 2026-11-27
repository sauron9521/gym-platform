import { randomUUID } from 'node:crypto';
import type { Prisma } from '#prisma/client';
import { publishOutboxEvent, type OutboxEventInput } from '../public-api.js';

function input(): Extract<OutboxEventInput, { type: 'account.security.changed' }> {
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
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
      ...e,
      schemaVersion: 2,
    }),
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
      ...e,
      type: 'unknown',
    }),
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
      ...e,
      actorUserId: randomUUID(),
    }),
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
      ...e,
      occurredAt: new Date(NaN),
    }),
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
      ...e,
      payload: { ...e.payload, secret: 'private-proof' },
    }),
    (e: Extract<OutboxEventInput, { type: 'account.security.changed' }>) => ({
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
