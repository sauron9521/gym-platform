import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '#prisma/client';
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { recordMfaSecurityEvent } from '../../../src/modules/auth/services/record-mfa-security-event.js';
import { OUTBOX_MAX_ATTEMPTS } from '../../../src/modules/notifications/domain/outbox-dispatch.policy.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('PostgreSQL notification dispatch', () => {
  const owner = randomUUID();
  const other = randomUUID();
  const old = new Date('2000-01-01T00:00:00.000Z');
  let prisma: PrismaService;
  let replica: PrismaService;
  let first: OutboxDispatchRepository;
  let second: OutboxDispatchRepository;

  beforeAll(async () => {
    useTestDatabase();
    const config = new ConfigService<AppEnv, true>({ DATABASE_URL: process.env.DATABASE_URL! });
    prisma = new PrismaService(config);
    replica = new PrismaService(config);
    await prisma.onModuleInit();
    await replica.onModuleInit();
    first = new OutboxDispatchRepository(prisma);
    second = new OutboxDispatchRepository(replica);
    await prisma.user.createMany({
      data: [owner, other].map((id) => ({
        id,
        email: 'dispatcher-' + id + '@example.test',
        passwordHash: 'test-only',
        emailVerified: true,
      })),
    });
  });

  async function cleanup() {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [owner, other] } } });
    await prisma.outboxEvent.deleteMany({ where: { actorUserId: { in: [owner, other] } } });
    await prisma.mfaLifecycleAudit.deleteMany({ where: { userId: { in: [owner, other] } } });
    await prisma.user.updateMany({
      where: { id: { in: [owner, other] } },
      data: { status: 'ACTIVE', deletedAt: null },
    });
  }

  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      }
    } finally {
      await replica?.onApplicationShutdown();
      await prisma?.onApplicationShutdown();
    }
  });

  async function seed(userId = owner) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.outboxEvent.findMany({
        where: { actorUserId: userId },
        select: { id: true },
      });
      await recordMfaSecurityEvent(tx, userId, 'FIRST_TOTP_CONFIRMED');
      const event = await tx.outboxEvent.findFirstOrThrow({
        where: { actorUserId: userId, id: { notIn: before.map((row) => row.id) } },
      });
      return tx.outboxEvent.update({
        where: { id: event.id },
        data: { availableAt: old },
      });
    });
  }

  async function claimFor(id: string, worker = first) {
    const claim = await worker.claim();
    expect(claim?.id).toBe(id);
    expect(claim?.status).toBe('PROCESSING');
    return claim!;
  }

  it('claims separate events concurrently and persists one Inbox row per event, including replay', async () => {
    const a = await seed(owner);
    const b = await seed(other);
    const [x, y] = await Promise.all([first.claim(), second.claim()]);
    expect(new Set([x?.id, y?.id])).toEqual(new Set([a.id, b.id]));
    expect(await Promise.all([first.process(x!), second.process(y!)])).toEqual([
      'processed',
      'processed',
    ]);
    expect(
      await prisma.outboxEvent.count({
        where: { id: { in: [a.id, b.id] }, status: 'PROCESSED', leaseUntil: null },
      }),
    ).toBe(2);
    const original = await prisma.notification.findFirstOrThrow({ where: { eventId: a.id } });
    expect(original).toMatchObject({
      recipientId: owner,
      scope: 'USER',
      category: 'ACCOUNT',
      templateKey: 'account.security.changed',
      resourceType: null,
      resourceId: null,
    });
    const saved = await prisma.notification.update({
      where: { id: original.id },
      data: { readAt: new Date() },
    });
    // Test-only replay simulates redelivery without re-running the business write.
    await prisma.outboxEvent.update({
      where: { id: a.id },
      data: { status: 'PENDING', availableAt: old, processedAt: null },
    });
    expect(await second.process(await claimFor(a.id, second))).toBe('processed');
    expect(await prisma.notification.findMany({ where: { eventId: a.id } })).toEqual([saved]);
  });

  it('reclaims a lost lease after a worker stops and fences its late completion and retry', async () => {
    const event = await seed();
    const stale = await claimFor(event.id);
    // Do not wait 30 seconds or change the system clock.
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { leaseUntil: old } });
    const fresh = await claimFor(event.id, second);
    expect(fresh.attemptCount).toBe(stale.attemptCount + 1);
    expect(await first.process(stale)).toBe('lease_lost');
    expect(await first.retry(stale)).toBe('lease_lost');
    expect(await second.process(fresh)).toBe('processed');
    expect(await first.retry(fresh)).toBe('lease_lost');
    expect(await prisma.notification.count({ where: { eventId: event.id } })).toBe(1);
  });

  it('rolls back Inbox and completion together if the transaction fails before commit', async () => {
    const event = await seed();
    const claim = await claimFor(event.id);
    // Use a real PostgreSQL transaction with an injected pre-commit failure.
    const failing = new OutboxDispatchRepository({
      $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        prisma.$transaction(async (tx) => {
          await work(tx);
          throw new Error('injected pre-commit failure');
        }),
    } as unknown as PrismaService);
    await expect(failing.process(claim)).rejects.toThrow('injected pre-commit failure');
    expect(await prisma.notification.count({ where: { eventId: event.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      'PROCESSING',
    );
    expect(await first.retry(claim)).toBe('retry');
    const retry = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(retry).toMatchObject({
      status: 'PENDING',
      leaseUntil: null,
      lastErrorCode: 'PROCESSING_FAILED',
    });
    expect(retry.availableAt.getTime()).toBeGreaterThan(retry.lastAttemptAt!.getTime());
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
    expect(await second.process(await claimFor(event.id, second))).toBe('processed');
  });

  it('bounds retries and abandoned last attempts without recreating the business event', async () => {
    const event = await seed();
    for (let i = 1; i <= OUTBOX_MAX_ATTEMPTS; i++) {
      const claim = await claimFor(event.id);
      expect(claim.attemptCount).toBe(i);
      expect(await first.retry(claim)).toBe(i === OUTBOX_MAX_ATTEMPTS ? 'dead_letter' : 'retry');
      if (i < OUTBOX_MAX_ATTEMPTS) {
        await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
      }
    }
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      status: 'DEAD_LETTER',
      attemptCount: OUTBOX_MAX_ATTEMPTS,
      leaseUntil: null,
    });
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PROCESSING', leaseUntil: old },
    });
    expect(await second.claim()).toMatchObject({
      id: event.id,
      status: 'DEAD_LETTER',
      attemptCount: OUTBOX_MAX_ATTEMPTS,
      leaseUntil: null,
    });
    expect(await prisma.notification.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.mfaLifecycleAudit.count({ where: { userId: owner } })).toBe(1);
  });

  it('fails closed for revoked accounts and malformed or mismatched events', async () => {
    const revoked = await seed();
    await prisma.user.update({ where: { id: owner }, data: { status: 'SUSPENDED' } });
    expect(await first.process(await claimFor(revoked.id))).toBe('skipped');
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id: revoked.id } })).toMatchObject(
      {
        status: 'PROCESSED',
        lastErrorCode: 'RECIPIENT_INELIGIBLE',
      },
    );
    const malformed = await seed(other);
    await prisma.outboxEvent.update({ where: { id: malformed.id }, data: { schemaVersion: 999 } });
    expect(await first.process(await claimFor(malformed.id))).toBe('dead_letter');
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({ where: { id: malformed.id } }),
    ).toMatchObject({ lastErrorCode: 'INVALID_EVENT' });
    const mismatch = await seed(other);
    await prisma.mfaLifecycleAudit.updateMany({
      where: { userId: other },
      data: { action: 'ADMIN_RECOVERY_CODES_REGENERATED' },
    });
    expect(await first.process(await claimFor(mismatch.id))).toBe('dead_letter');
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({ where: { id: mismatch.id } }),
    ).toMatchObject({ lastErrorCode: 'SOURCE_MISMATCH' });
    expect(
      await prisma.notification.count({ where: { recipientId: { in: [owner, other] } } }),
    ).toBe(0);
  });

  it('does not overwrite an inconsistent existing notification on replay', async () => {
    const event = await seed();
    const conflicting = await prisma.notification.create({
      data: {
        eventId: event.id,
        recipientId: owner,
        scope: 'USER',
        category: 'ACCOUNT',
        type: 'unrecognized',
        templateKey: 'unrecognized',
      },
    });
    expect(await first.process(await claimFor(event.id))).toBe('dead_letter');
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      lastErrorCode: 'INBOX_CONFLICT',
    });
    expect(await prisma.notification.findUnique({ where: { id: conflicting.id } })).toEqual(
      conflicting,
    );
  });
});
