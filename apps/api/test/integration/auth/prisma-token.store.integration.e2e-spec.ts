import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaTokenStore } from '../../../src/modules/auth/stores/index.js';
import { PrismaModule, PrismaService } from '../../../src/infra/database/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

let app: INestApplication;
let prisma: PrismaService;
let store: PrismaTokenStore;
const testUserIds = new Set<string>();

class ContractTokenStore implements RefreshTokenStore, EmailTokenStore {
  constructor(
    private readonly persistence: PrismaTokenStore,
    private readonly db: PrismaService,
  ) {}

  getRefreshToken(id: string) {
    return this.persistence.getRefreshToken(id);
  }

  async saveRefreshToken(record: RefreshTokenRecord) {
    await this.ensureUser(record.userId);
    await this.persistence.saveRefreshToken(record);
  }

  markRefreshTokenUsed(id: string, at: Date) {
    return this.persistence.markRefreshTokenUsed(id, at);
  }

  revokeRefreshTokenFamily(familyId: string) {
    return this.persistence.revokeRefreshTokenFamily(familyId);
  }

  isRefreshTokenFamilyRevoked(familyId: string) {
    return this.persistence.isRefreshTokenFamilyRevoked(familyId);
  }

  revokeUserRefreshTokens(userId: string) {
    return this.persistence.revokeUserRefreshTokens(userId);
  }

  async saveEmailToken(record: EmailTokenRecord) {
    await this.ensureUser(record.userId);
    await this.persistence.saveEmailToken(record);
  }

  consumeEmailToken(id: string, purpose: EmailTokenPurpose) {
    return this.persistence.consumeEmailToken(id, purpose);
  }

  deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose) {
    return this.persistence.deleteUserEmailTokens(userId, purpose);
  }

  private async ensureUser(userId: string): Promise<void> {
    const emailHash = createHash('sha256').update(userId).digest('hex');
    await this.db.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${emailHash}@token-contract.invalid`,
        passwordHash: 'contract-test-password-hash',
      },
      update: {},
      select: { id: true },
    });
    testUserIds.add(userId);
  }
}

const contractCases = authenticationStoreContract(
  async () => {
    if (!store || !prisma) {
      throw new Error('Test database and PrismaTokenStore must be initialized.');
    }
    const adapter = new ContractTokenStore(store, prisma);
    return { refreshTokens: adapter, emailTokens: adapter };
  },
  { contracts: ['refreshTokens', 'emailTokens'], concurrent: true },
);

describe('PrismaTokenStore integration (e2e)', () => {
  beforeAll(async () => {
    useTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [await ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [AuthenticationStorage, PrismaTokenStore],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    store = app.get(PrismaTokenStore);
  }, 20_000);

  afterAll(async () => {
    try {
      if (prisma && testUserIds.size > 0) {
        // User FK cascade removes token rows and family rows.
        await prisma.user.deleteMany({
          where: { id: { in: [...testUserIds] } },
        });
      }
    } finally {
      await app?.close();
    }
  }, 20_000);

  for (const contractCase of contractCases) {
    it(contractCase.name, () => contractCase.run());
  }

  it('keeps a family revoked when a successor is saved afterward', async () => {
    const userId = `token-family-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@token-family.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date();
    const familyId = randomUUID().replaceAll('-', '');
    const original: RefreshTokenRecord = {
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      familyExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    };
    await store.saveRefreshToken(original);
    await store.revokeRefreshTokenFamily(familyId);

    const successor: RefreshTokenRecord = {
      ...original,
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      createdAt: new Date(now.getTime() + 1),
      expiresAt: new Date(now.getTime() + 60_001),
    };
    await store.saveRefreshToken(successor);

    await expect(store.isRefreshTokenFamilyRevoked(familyId)).resolves.toBe(true);
    await expect(store.getRefreshToken(successor.id)).resolves.toMatchObject({
      id: successor.id,
      familyId,
    });
    const persisted = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: successor.id },
      select: { revoked: true },
    });
    expect(persisted.revoked).toBe(true);
  });

  it('keeps all token rows revoked when saving and revocation race', async () => {
    const userId = `token-revoke-race-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@token-race.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date();
    const familyId = randomUUID().replaceAll('-', '');
    const original: RefreshTokenRecord = {
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      familyExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    };
    await store.saveRefreshToken(original);
    const successor: RefreshTokenRecord = {
      ...original,
      id: createHash('sha256').update(randomUUID()).digest('hex'),
    };
    await Promise.all([
      store.saveRefreshToken(successor),
      store.revokeRefreshTokenFamily(familyId),
    ]);
    const family = await prisma.refreshTokenFamily.findUniqueOrThrow({
      where: { id: familyId },
      select: { revokedAt: true },
    });
    const tokens = await prisma.refreshToken.findMany({
      where: { familyId },
      select: { revoked: true },
    });
    expect(family.revokedAt).toBeInstanceOf(Date);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((token) => token.revoked)).toBe(true);
    await expect(store.isRefreshTokenFamilyRevoked(familyId)).resolves.toBe(true);
  });

  it('cleans expired refresh families at the cutoff while retaining live families', async () => {
    const userId = `refresh-cleanup-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@refresh-cleanup.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date('2026-11-10T12:00:00.000Z');
    const expiredFamilyId = randomUUID().replaceAll('-', '');
    const liveFamilyId = randomUUID().replaceAll('-', '');

    const expired: RefreshTokenRecord = {
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId: expiredFamilyId,
      userId,
      createdAt: new Date(now.getTime() - 120_000),
      expiresAt: new Date(now.getTime() - 60_000),
      familyExpiresAt: now,
    };
    const live: RefreshTokenRecord = {
      ...expired,
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId: liveFamilyId,
      // Individual token expiry is not the family-retention cutoff.
      familyExpiresAt: new Date(now.getTime() + 60_000),
    };

    await store.saveRefreshToken(expired);
    await store.saveRefreshToken(live);
    await store.deleteExpiredRefreshTokens(now);

    await expect(prisma.refreshToken.findUnique({ where: { id: expired.id } })).resolves.toBeNull();
    await expect(
      prisma.refreshTokenFamily.findUnique({ where: { id: expiredFamilyId } }),
    ).resolves.toBeNull();

    await expect(prisma.refreshToken.findUnique({ where: { id: live.id } })).resolves.toMatchObject(
      { familyId: liveFamilyId, userId },
    );
    await expect(
      prisma.refreshTokenFamily.findUnique({ where: { id: liveFamilyId } }),
    ).resolves.toMatchObject({ userId, revokedAt: null });
  });

  it('cascades rotated tokens and safely handles concurrent cleanup at the cutoff', async () => {
    const userId = `cleanup-cascade-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@cleanup-cascade.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date('2026-11-10T12:00:00.000Z');
    const expiredFamilyId = randomUUID().replaceAll('-', '');
    const liveFamilyId = randomUUID().replaceAll('-', '');
    const baseToken: RefreshTokenRecord = {
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId: expiredFamilyId,
      userId,
      createdAt: new Date(now.getTime() - 120_000),
      expiresAt: new Date(now.getTime() - 60_000),
      familyExpiresAt: now,
    };
    const rotated: RefreshTokenRecord = {
      ...baseToken,
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      createdAt: new Date(now.getTime() - 90_000),
    };
    const live: RefreshTokenRecord = {
      ...baseToken,
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId: liveFamilyId,
      familyExpiresAt: new Date(now.getTime() + 60_000),
    };

    await store.saveRefreshToken(baseToken);
    await store.saveRefreshToken(rotated);
    await store.revokeRefreshTokenFamily(expiredFamilyId);
    await store.saveRefreshToken(live);

    // Multiple app replicas may run cleanup at the same scheduled time.
    const cleanup = () => store.deleteExpiredRefreshTokens(now);
    await Promise.all([cleanup(), cleanup()]);

    expect(await prisma.refreshTokenFamily.count({ where: { id: expiredFamilyId } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { familyId: expiredFamilyId } })).toBe(0);
    expect(await prisma.refreshTokenFamily.count({ where: { id: liveFamilyId } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { id: live.id } })).toBe(1);

    await store.deleteExpiredRefreshTokens(now);
    expect(await prisma.refreshToken.count({ where: { id: live.id } })).toBe(1);
  });

  it('deletes expired email tokens during cleanup', async () => {
    const userId = `email-cleanup-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@email-cleanup.invalid`;

    await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: 'test-password-hash',
      },
      select: { id: true },
    });

    testUserIds.add(userId);

    const now = new Date('2023-11-14T22:13:20.000Z');

    const expiredToken: EmailTokenRecord = {
      id: randomUUID().replaceAll('-', ''),
      purpose: 'password-reset',
      userId,
      email,
      fingerprint: 'expired-fingerprint',
      createdAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() - 1_000),
    };

    const validToken: EmailTokenRecord = {
      id: randomUUID().replaceAll('-', ''),
      purpose: 'password-reset',
      userId,
      email,
      fingerprint: 'valid-fingerprint',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    };

    await store.saveEmailToken(expiredToken);
    await store.saveEmailToken(validToken);

    await store.deleteExpiredEmailTokens(now);

    await expect(
      store.consumeEmailToken(expiredToken.id, 'password-reset'),
    ).resolves.toBeUndefined();

    await expect(store.consumeEmailToken(validToken.id, 'password-reset')).resolves.toMatchObject({
      id: validToken.id,
      userId,
    });
  });

  it('allows one concurrent refresh-token use in PostgreSQL', async () => {
    const userId = `refresh-race-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@refresh-race.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date();
    const token: RefreshTokenRecord = {
      id: createHash('sha256').update(randomUUID()).digest('hex'),
      familyId: randomUUID().replaceAll('-', ''),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      familyExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    };
    await store.saveRefreshToken(token);

    // Parallel calls share the real database connection pool, not an in-memory mock.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => store.markRefreshTokenUsed(token.id, now)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => !result)).toHaveLength(7);
    await expect(store.markRefreshTokenUsed(token.id, now)).resolves.toBe(false);

    const persisted = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: token.id },
      select: { usedAt: true, familyId: true, revoked: true },
    });
    expect(persisted).toEqual({
      usedAt: now,
      familyId: token.familyId,
      revoked: false,
    });
  });

  it('consumes an email token only once across parallel requests', async () => {
    const userId = `email-race-${randomUUID()}`;
    const email = `${createHash('sha256').update(userId).digest('hex')}@email-race.invalid`;
    await prisma.user.create({
      data: { id: userId, email, passwordHash: 'test-password-hash' },
      select: { id: true },
    });
    testUserIds.add(userId);

    const now = new Date();
    const token: EmailTokenRecord = {
      id: randomUUID().replaceAll('-', ''),
      purpose: 'password-reset',
      userId,
      email,
      fingerprint: 'race-test',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    };
    await store.saveEmailToken(token);

    await expect(store.consumeEmailToken(token.id, 'email-verification')).resolves.toBeUndefined();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => store.consumeEmailToken(token.id, token.purpose)),
    );
    const winners = results.filter((record) => record !== undefined);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ id: token.id, userId, purpose: token.purpose });
    expect(results.filter((record) => record === undefined)).toHaveLength(7);
    await expect(store.consumeEmailToken(token.id, token.purpose)).resolves.toBeUndefined();
    expect(await prisma.emailToken.count({ where: { id: token.id } })).toBe(0);
  });
});
