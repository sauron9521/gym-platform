import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthenticationStorage } from '@nestjs/authentication';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthCleanupLockService } from '../../../src/modules/auth/services/auth-cleanup-lock.service.js';
import { PrismaSessionStore, PrismaTokenStore } from '../../../src/modules/auth/stores/index.js';
import { PrismaModule, PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

describe('Auth retention batching and cross-replica lock (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: PrismaTokenStore;
  let sessions: PrismaSessionStore;
  let advisory: AuthCleanupLockService;
  let userId: string;

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [
        PrismaTokenStore,
        PrismaSessionStore,
        AuthCleanupLockService,
        { provide: AuthenticationStorage, useValue: { registerSource: () => undefined } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(PrismaTokenStore);
    sessions = app.get(PrismaSessionStore);
    advisory = app.get(AuthCleanupLockService);
    const user = await prisma.user.create({
      data: {
        email: `cleanup-batches-${randomUUID()}@example.test`,
        passwordHash: 'test-only',
      },
      select: { id: true },
    });
    userId = user.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (prisma && userId) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  it('deletes 61 expired rows in batches of 25 with cascade, retaining live rows', async () => {
    // A historical cutoff makes the fixtures independent of the CI clock and
    // avoids deleting other suites' current data.
    const cutoff = new Date('2001-01-01T00:00:00.000Z');
    const expired = new Date('2000-12-31T23:59:59.000Z');
    const live = new Date('2001-01-02T00:00:00.000Z');
    const families = Array.from({ length: 61 }, () => randomUUID().replaceAll('-', ''));
    const liveFamily = randomUUID().replaceAll('-', '');
    const email = 'cleanup@example.test';
    const tokenId = () => randomUUID().replaceAll('-', '').repeat(2);

    await prisma.refreshTokenFamily.createMany({
      data: [
        ...families.map((id) => ({ id, userId, familyExpiresAt: expired })),
        { id: liveFamily, userId, familyExpiresAt: live },
      ],
    });
    await prisma.refreshToken.createMany({
      data: [
        ...families.flatMap((familyId) =>
          [0, 1].map(() => ({
            id: tokenId(),
            familyId,
            userId,
            createdAt: expired,
            expiresAt: expired,
            familyExpiresAt: expired,
          })),
        ),
        {
          id: tokenId(),
          familyId: liveFamily,
          userId,
          createdAt: expired,
          expiresAt: expired,
          familyExpiresAt: live,
        },
      ],
    });
    await prisma.emailToken.createMany({
      data: [
        ...Array.from({ length: 61 }, () => ({
          id: tokenId(),
          purpose: 'password-reset',
          userId,
          email,
          createdAt: expired,
          expiresAt: expired,
        })),
        {
          id: tokenId(),
          purpose: 'password-reset',
          userId,
          email,
          createdAt: expired,
          expiresAt: live,
        },
      ],
    });
    await prisma.session.createMany({
      data: [
        ...Array.from({ length: 61 }, () => ({
          id: tokenId(),
          userId,
          createdAt: expired,
          expiresAt: expired,
          lastActiveAt: expired,
        })),
        {
          id: tokenId(),
          userId,
          createdAt: expired,
          expiresAt: live,
          lastActiveAt: expired,
        },
      ],
    });

    const before = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "refresh_token_families"
      WHERE "family_expires_at" <= ${cutoff}
      ORDER BY "family_expires_at", "id"
      LIMIT 25 FOR UPDATE SKIP LOCKED
    `;
    expect(before).toHaveLength(1);
    expect(before[0]?.['QUERY PLAN']).toBeDefined();

    const startedAt = performance.now();
    const results: number[][] = [];
    for (let i = 0; i < 10; i += 1) {
      const counts = [
        await tokens.deleteExpiredRefreshTokenFamiliesBatch(cutoff, 25),
        await tokens.deleteExpiredEmailTokensBatch(cutoff, 25),
        await sessions.deleteExpiredSessionsBatch(cutoff, 25),
      ];
      results.push(counts);
      if (counts.every((count) => count < 25)) break;
    }
    const elapsedMs = Math.round(performance.now() - startedAt);

    expect(results).toEqual([
      [25, 25, 25],
      [25, 25, 25],
      [11, 11, 11],
    ]);
    expect(await prisma.refreshToken.count({ where: { familyId: { in: families } } })).toBe(0);
    expect(await prisma.refreshTokenFamily.count({ where: { id: liveFamily } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { familyId: liveFamily } })).toBe(1);
    expect(await prisma.emailToken.count({ where: { userId } })).toBe(1);
    expect(await prisma.session.count({ where: { userId } })).toBe(1);

    // An informational test-database measurement. Deliberately no timing
    // threshold: shared GitHub runners have variable PostgreSQL performance.
    console.info(
      `AUTH_CLEANUP_BENCHMARK rowsPerTable=61 batchSize=25 batches=3 elapsedMs=${elapsedMs}`,
    );
  });

  it('reclaims 3001 expired rows per table in bounded batches without touching active data', async () => {
    const user = await prisma.user.create({
      data: {
        email: `cleanup-stress-${randomUUID()}@example.test`,
        passwordHash: 'test-only',
      },
      select: { id: true },
    });

    try {
      // An old cutoff is isolated from the 2001 fixture and the CI clock.
      const cutoff = new Date('1998-01-01T00:00:00.000Z');
      const expired = new Date('1997-12-31T23:59:59.000Z');
      const live = new Date('1999-01-01T00:00:00.000Z');
      const count = 3001;
      const batchSize = 500;
      const tokenId = () => randomUUID().replaceAll('-', '').repeat(2);
      const families = Array.from({ length: count }, () => randomUUID().replaceAll('-', ''));
      const liveFamily = randomUUID().replaceAll('-', '');

      await prisma.refreshTokenFamily.createMany({
        data: [
          ...families.map((id) => ({ id, userId: user.id, familyExpiresAt: expired })),
          { id: liveFamily, userId: user.id, familyExpiresAt: live },
        ],
      });
      await prisma.refreshToken.createMany({
        data: [
          ...families.flatMap((familyId) =>
            [0, 1].map(() => ({
              id: tokenId(),
              familyId,
              userId: user.id,
              createdAt: expired,
              expiresAt: expired,
              familyExpiresAt: expired,
            })),
          ),
          {
            id: tokenId(),
            familyId: liveFamily,
            userId: user.id,
            createdAt: expired,
            // A token may individually expire while its family remains live.
            expiresAt: expired,
            familyExpiresAt: live,
          },
        ],
      });
      await prisma.emailToken.createMany({
        data: [
          ...Array.from({ length: count }, () => ({
            id: tokenId(),
            purpose: 'password-reset',
            userId: user.id,
            email: 'cleanup-stress@example.test',
            createdAt: expired,
            expiresAt: expired,
          })),
          {
            id: tokenId(),
            purpose: 'password-reset',
            userId: user.id,
            email: 'cleanup-stress@example.test',
            createdAt: expired,
            expiresAt: live,
          },
        ],
      });
      await prisma.session.createMany({
        data: [
          ...Array.from({ length: count }, () => ({
            id: tokenId(),
            userId: user.id,
            createdAt: expired,
            expiresAt: expired,
            lastActiveAt: expired,
          })),
          {
            id: tokenId(),
            userId: user.id,
            createdAt: expired,
            expiresAt: live,
            lastActiveAt: expired,
          },
        ],
      });

      const startedAt = performance.now();
      const results: number[][] = [];
      for (let round = 0; round < 10; round += 1) {
        const deleted = [
          await tokens.deleteExpiredRefreshTokenFamiliesBatch(cutoff, batchSize),
          await tokens.deleteExpiredEmailTokensBatch(cutoff, batchSize),
          await sessions.deleteExpiredSessionsBatch(cutoff, batchSize),
        ];
        results.push(deleted);
        if (deleted.every((n) => n < batchSize)) break;
      }
      const elapsedMs = Math.round(performance.now() - startedAt);

      expect(results).toHaveLength(7);
      expect(results.slice(0, 6).every((counts) => counts.every((n) => n === 500))).toBe(
        true,
      );
      expect(results[6]).toEqual([1, 1, 1]);
      expect(await prisma.refreshTokenFamily.count({ where: { userId: user.id } })).toBe(
        1,
      );
      expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(1);
      expect(await prisma.emailToken.count({ where: { userId: user.id } })).toBe(1);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
      expect(
        await prisma.refreshToken.findFirst({
          where: { userId: user.id },
          select: { familyId: true },
        }),
      ).toEqual({ familyId: liveFamily });

      // Informational only: CI runner load varies, so assert correctness,
      // not a hard latency budget.
      console.info(
        `AUTH_CLEANUP_STRESS expiredPerTable=${count} cascadedTokens=${count * 2} batchSize=${batchSize} rounds=${results.length} elapsedMs=${elapsedMs}`,
      );
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('allows one PostgreSQL session lock holder and releases it on completion', async () => {
    let release!: () => void;
    let entered!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      entered = resolve;
    });

    const first = advisory.runExclusive(async () => {
      entered();
      await holding;
    });
    try {
      await acquired;
      const second = await advisory.runExclusive(async () => {
        throw new Error('A competing replica must not execute cleanup');
      });
      expect(second).toBe(false);
    } finally {
      release();
      await first;
    }

    await expect(advisory.runExclusive(async () => undefined)).resolves.toBe(true);
  });

  it('releases the advisory lock even when cleanup fails', async () => {
    await expect(
      advisory.runExclusive(async () => {
        throw new Error('intentional cleanup failure');
      }),
    ).rejects.toThrow('intentional cleanup failure');
    await expect(advisory.runExclusive(async () => undefined)).resolves.toBe(true);
  });
});
