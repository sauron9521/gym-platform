import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import {
  publishOutboxEvent,
  type OutboxEventInput,
} from '../../../src/modules/notifications/public-api.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Transactional outbox publisher (PostgreSQL)', () => {
  let prisma: PrismaService;
  const owner = randomUUID();

  function event(): OutboxEventInput {
    return {
      type: 'account.security.changed',
      schemaVersion: 1,
      occurredAt: new Date(),
      actorUserId: owner,
      payload: {
        aggregate: { kind: 'MfaLifecycleAudit', id: randomUUID() },
        context: { userId: owner, action: 'FIRST_TOTP_CONFIRMED' },
      },
    };
  }

  beforeAll(async () => {
    useTestDatabase();
    prisma = new PrismaService(
      new ConfigService<AppEnv, true>({
        DATABASE_URL: process.env.DATABASE_URL!,
      }),
    );
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.outboxEvent.deleteMany({ where: { actorUserId: owner } });
      await prisma.mfaLifecycleAudit.deleteMany({ where: { userId: owner } });
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  it('deduplicates concurrent publications and preserves processing state on replay', async () => {
    const input = event();
    const key = 'mfa-lifecycle:' + input.payload.aggregate.id + ':v1';
    const results = await Promise.all([
      prisma.$transaction((tx) => publishOutboxEvent(tx, input)),
      prisma.$transaction((tx) => publishOutboxEvent(tx, input)),
    ]);
    expect(results.sort()).toEqual(['existing', 'inserted']);
    const original = await prisma.outboxEvent.update({
      where: { eventKey: key },
      data: { status: 'PROCESSED', attemptCount: 1, processedAt: new Date() },
    });
    await expect(prisma.$transaction((tx) => publishOutboxEvent(tx, input))).resolves.toBe(
      'existing',
    );
    expect(await prisma.outboxEvent.findUnique({ where: { eventKey: key } })).toEqual(original);
  });

  it('rolls back source writes and publication together', async () => {
    const input = event();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.mfaLifecycleAudit.create({
          data: {
            id: input.payload.aggregate.id,
            userId: owner,
            action: input.payload.context.action,
          },
        });
        expect(await publishOutboxEvent(tx, input)).toBe('inserted');
        throw new Error('injected rollback');
      }),
    ).rejects.toThrow('injected rollback');
    expect(
      await prisma.mfaLifecycleAudit.findUnique({ where: { id: input.payload.aggregate.id } }),
    ).toBeNull();
    expect(
      await prisma.outboxEvent.findUnique({
        where: { eventKey: 'mfa-lifecycle:' + input.payload.aggregate.id + ':v1' },
      }),
    ).toBeNull();
  });

  it('rejects conflicting immutable data without modifying the existing row', async () => {
    const input = event();
    await prisma.$transaction((tx) => publishOutboxEvent(tx, input));
    const key = 'mfa-lifecycle:' + input.payload.aggregate.id + ':v1';
    const original = await prisma.outboxEvent.findUniqueOrThrow({ where: { eventKey: key } });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.mfaLifecycleAudit.create({
          data: {
            id: input.payload.aggregate.id,
            userId: owner,
            action: 'ADMIN_TOTP_REPLACEMENT_STAGED',
          },
        });
        await publishOutboxEvent(tx, {
          ...input,
          payload: {
            ...input.payload,
            context: { ...input.payload.context, action: 'ADMIN_TOTP_REPLACEMENT_STAGED' },
          },
        });
      }),
    ).rejects.toThrow('Outbox event key conflict');
    expect(
      await prisma.mfaLifecycleAudit.findUnique({ where: { id: input.payload.aggregate.id } }),
    ).toBeNull();
    expect(await prisma.outboxEvent.findUnique({ where: { eventKey: key } })).toEqual(original);
  });
});
