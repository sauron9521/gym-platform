import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthenticationStorage } from '@nestjs/authentication';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaSessionStore, PrismaTokenStore } from '../../../src/modules/auth/stores/index.js';
import { PrismaModule, PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const EXPIRED_PER_TABLE = 1_200;
const BATCH_SIZE = 500;

describe('Auth cleanup medium-volume PostgreSQL regression', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: PrismaTokenStore;
  let sessions: PrismaSessionStore;
  let userId: string;

  beforeAll(async () => {
    useTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [
        PrismaTokenStore,
        PrismaSessionStore,
        { provide: AuthenticationStorage, useValue: { registerSource: () => undefined } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(PrismaTokenStore);
    sessions = app.get(PrismaSessionStore);
    const user = await prisma.user.create({
      data: {
        email: `auth-volume-${randomUUID()}@example.test`,
        passwordHash: 'test-only-password',
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

  it('deletes 1200 expired rows per table in 500/500/200 batches', async () => {
    const cutoff = new Date('2001-01-01T00:00:00.000Z');
    const expired = new Date('2000-12-31T23:59:59.000Z');
    // Use dates in the far future so unrelated cleanup tests cannot remove
    // these active controls even if their cutoff uses the current wall clock.
    const active = new Date('2100-01-01T00:00:00.000Z');
    const tokenId = () => randomUUID().replaceAll('-', '').repeat(2);
    const families: string[] = [];
    for (let i = 0; i < EXPIRED_PER_TABLE; i += 1) {
      families.push(randomUUID().replaceAll('-', ''));
    }
    const liveFamily = randomUUID().replaceAll('-', '');
    const email = 'auth-volume@example.test';

    await prisma.refreshTokenFamily.createMany({
      data: [
        ...families.map((id) => ({ id, userId, familyExpiresAt: expired })),
        { id: liveFamily, userId, familyExpiresAt: active },
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
          familyExpiresAt: active,
        },
      ],
    });
    await prisma.emailToken.createMany({
      data: [
        ...Array.from({ length: EXPIRED_PER_TABLE }, () => ({
          id: tokenId(),
          userId,
          purpose: 'password-reset',
          email,
          createdAt: expired,
          expiresAt: expired,
        })),
        {
          id: tokenId(),
          userId,
          purpose: 'password-reset',
          email,
          createdAt: expired,
          expiresAt: active,
        },
      ],
    });
    await prisma.session.createMany({
      data: [
        ...Array.from({ length: EXPIRED_PER_TABLE }, () => ({
          id: tokenId(),
          userId,
          createdAt: expired,
          lastActiveAt: expired,
          expiresAt: expired,
        })),
        {
          id: tokenId(),
          userId,
          createdAt: expired,
          lastActiveAt: expired,
          expiresAt: active,
        },
      ],
    });

    // Measure the real indexed selection plan without enforcing a particular
    // scan strategy: PostgreSQL may choose a sequential scan on tiny CI data.
    const plan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "refresh_token_families"
      WHERE "family_expires_at" <= ${cutoff}
      ORDER BY "family_expires_at", "id"
      LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED
    `;
    expect(plan).toHaveLength(1);
    expect(plan[0]?.['QUERY PLAN']).toBeDefined();

    const startedAt = performance.now();
    const results: number[][] = [];
    for (let round = 0; round < 3; round += 1) {
      results.push([
        await tokens.deleteExpiredRefreshTokenFamiliesBatch(cutoff, BATCH_SIZE),
        await tokens.deleteExpiredEmailTokensBatch(cutoff, BATCH_SIZE),
        await sessions.deleteExpiredSessionsBatch(cutoff, BATCH_SIZE),
      ]);
    }
    const elapsedMs = Math.round(performance.now() - startedAt);

    expect(results).toEqual([
      [500, 500, 500],
      [500, 500, 500],
      [200, 200, 200],
    ]);
    expect(await tokens.deleteExpiredRefreshTokenFamiliesBatch(cutoff, BATCH_SIZE)).toBe(0);
    expect(await tokens.deleteExpiredEmailTokensBatch(cutoff, BATCH_SIZE)).toBe(0);
    expect(await sessions.deleteExpiredSessionsBatch(cutoff, BATCH_SIZE)).toBe(0);

    expect(await prisma.refreshTokenFamily.count({ where: { id: { in: families } } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId } })).toBe(1);
    expect(await prisma.refreshTokenFamily.count({ where: { id: liveFamily } })).toBe(1);
    expect(await prisma.emailToken.count({ where: { userId } })).toBe(1);
    expect(await prisma.session.count({ where: { userId } })).toBe(1);

    // Informational regression metric: never use a runner-dependent timeout
    // assertion as a test failure condition.
    console.info(
      `AUTH_CLEANUP_VOLUME expiredPerTable=${EXPIRED_PER_TABLE} batchSize=${BATCH_SIZE} rounds=3 elapsedMs=${elapsedMs}`,
    );
  }, 60_000);
});
