import { randomUUID } from 'node:crypto';

import { AuthenticationStorage, MfaService, type MfaStore } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/infra/database/index.js';
import { PrismaMfaStore } from '../../../src/modules/auth/stores/index.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const domain = `mfa-contract-${randomUUID()}.test`;
let app: INestApplication;
let prisma: PrismaService;

async function seed(userId: string) {
  await prisma.user.create({
    data: { id: userId, email: `${userId}@${domain}`, passwordHash: 'contract-test-hash' },
  });
}

function createMfaStore() {
  const store = new PrismaMfaStore(prisma, new AuthenticationStorage());
  const users = new Map<string, Promise<void>>();
  // The upstream contract uses synthetic owners; provision each once, not
  // once per attempt, so parallel store operations still race on PostgreSQL.
  function ensure(userId: string): Promise<void> {
    const existing = users.get(userId);
    if (existing) return existing;
    const created = seed(userId);
    users.set(userId, created);
    return created;
  }
  const mfa: MfaStore = {
    getTotp: (id) => store.getTotp(id),
    saveTotp: async (id, record) => {
      await ensure(id);
      await store.saveTotp(id, record);
    },
    claimTotpStep: (id, step) => store.claimTotpStep(id, step),
    saveRecoveryCodes: async (id, hashes) => {
      await ensure(id);
      await store.saveRecoveryCodes(id, hashes);
    },
    consumeRecoveryCode: (id, hash) => store.consumeRecoveryCode(id, hash),
    countRecoveryCodes: (id) => store.countRecoveryCodes(id),
    recordMfaFailure: async (id, window, now) => {
      await ensure(id);
      return store.recordMfaFailure(id, window, now);
    },
    countMfaFailures: (id, window, now) => store.countMfaFailures(id, window, now),
    clearMfaFailures: (id) => store.clearMfaFailures(id),
  };
  return { mfa };
}

beforeAll(async () => {
  useTestDatabase();
  const { AppModule } = await import('../../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
}, 30_000);

afterAll(async () => {
  try {
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  } finally {
    await app?.close();
  }
}, 20_000);

describe('PrismaMfaStore (PostgreSQL)', () => {
  for (const contract of authenticationStoreContract(createMfaStore, {
    contracts: ['mfa'],
    concurrent: true,
  })) {
    it(contract.name, () => contract.run());
  }

  it('persists only library-sealed secrets and hashed recovery codes across store instances', async () => {
    const userId = randomUUID();
    await seed(userId);
    const storage = new AuthenticationStorage();
    new PrismaMfaStore(prisma, storage);
    // Test key only; the running application deliberately leaves MFA disabled.
    const options = { mfa: { encryption: { keys: ['test-only-mfa-key-material-32-bytes'] } } };
    const service = new MfaService(storage, options);
    const { secret } = await service.enroll(userId, 'test-account');
    const codes = await service.generateRecoveryCodes(userId);
    const stored = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { userId } });
    expect(stored.secret).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+\.[^.]+$/);
    expect(stored.secret).not.toContain(secret);
    const rows = await prisma.mfaRecoveryCode.findMany({ where: { userId } });
    expect(rows).toHaveLength(codes.length);
    for (const row of rows) {
      expect(row.hash).toMatch(/^rc1\.[A-Za-z0-9_-]+$/);
      expect(codes).not.toContain(row.hash);
    }

    const restartedStorage = new AuthenticationStorage();
    new PrismaMfaStore(prisma, restartedStorage);
    const restarted = new MfaService(restartedStorage, options);
    expect(await restarted.verifyRecoveryCode(userId, codes[0]!)).toBe(true);
    expect(await restarted.verifyRecoveryCode(userId, codes[0]!)).toBe(false);
  });

  it('rolls back an invalid replacement batch and preserves the previous recovery codes', async () => {
    const userId = randomUUID();
    await seed(userId);
    const store = app.get(PrismaMfaStore);
    await store.saveRecoveryCodes(userId, ['rc1.original']);
    await expect(
      store.saveRecoveryCodes(userId, ['rc1.duplicate', 'rc1.duplicate']),
    ).rejects.toThrow();
    expect(await store.countRecoveryCodes(userId)).toBe(1);
    expect(await store.consumeRecoveryCode(userId, 'rc1.original')).toBe(true);
  });

  it('denies suspended accounts and cascades factor material on physical deletion', async () => {
    const userId = randomUUID();
    await seed(userId);
    const store = app.get(PrismaMfaStore);
    await store.saveTotp(userId, { secret: 'v1.synthetic', confirmed: true });
    await store.saveRecoveryCodes(userId, ['rc1.synthetic']);
    await store.recordMfaFailure(userId, 60_000, Date.now());
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    expect(await store.getTotp(userId)).toBeUndefined();
    expect(await store.claimTotpStep(userId, 10)).toBe(false);
    expect(await store.consumeRecoveryCode(userId, 'rc1.synthetic')).toBe(false);
    await expect(store.saveTotp(userId, { secret: 'v1.new', confirmed: true })).rejects.toThrow();
    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.mfaAuthenticator.count({ where: { userId } })).toBe(0);
    expect(await prisma.mfaRecoveryCode.count({ where: { userId } })).toBe(0);
    expect(await prisma.mfaFailure.count({ where: { userId } })).toBe(0);
  });
});
