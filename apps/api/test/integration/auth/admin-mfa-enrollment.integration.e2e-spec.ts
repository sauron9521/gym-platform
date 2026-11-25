import { createHash, randomUUID } from 'node:crypto';

import { PasswordHasher } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../../src/infra/database/index.js';
import { AdminMfaEnrollmentService } from '../../../src/modules/auth/services/admin-mfa-enrollment.service.js';
import { PrismaMfaStore } from '../../../src/modules/auth/stores/index.js';
import { AuthAccountThrottleService } from '../../../src/modules/auth/services/auth-account-throttle.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

const domain = `enrollment-${randomUUID()}.test`;
const password = 'Test-only enrollment password';
let app: INestApplication;
let prisma: PrismaService;
let service: AdminMfaEnrollmentService;
let hash: string;
const keyring = createHash('sha256').update('enrollment test fixture').digest('base64url');

async function seed(role: 'ADMIN' | 'ATHLETE' = 'ADMIN', purpose = 'admin') {
  const userId = randomUUID();
  await prisma.user.create({
    data: { id: userId, email: `${userId}@${domain}`, passwordHash: hash, role },
  });
  const sessionId = randomUUID();
  const now = new Date();
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      metadata: { purpose },
    },
  });
  return { userId, sessionId };
}

beforeAll(async () => {
  useTestDatabase();
  const { AppModule } = await import('../../../src/app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
  app.get(ConfigService).set('MFA_ENCRYPTION_KEYS', keyring);
  service = app.get(AdminMfaEnrollmentService);
  hash = await app.get(PasswordHasher).hash(password);
}, 30_000);

afterAll(async () => {
  try {
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  } finally {
    await app?.close();
  }
}, 20_000);

describe('Admin first MFA enrollment (internal, PostgreSQL)', () => {
  it('stages an encrypted unconfirmed secret bound to the exact session for at most five minutes', async () => {
    const principal = await seed();
    const start = Date.now();
    const result = await service.begin(principal, password);
    const row = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: principal.userId },
    });
    expect(result.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(row.secret).toMatch(/^v1\./);
    expect(row.secret).not.toContain(result.secret);
    expect(row.confirmed).toBe(false);
    expect(row.enrollmentSessionId).toBe(principal.sessionId);
    expect(row.enrollmentExpiresAt).toEqual(result.expiresAt);
    expect(result.expiresAt.getTime()).toBeGreaterThan(start);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 300_000);
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: principal.userId } })).toBe(0);
  });

  it('denies wrong password, regular sessions, wrong owner and non-admin principals', async () => {
    const admin = await seed();
    const regular = await seed('ADMIN', 'web');
    const athlete = await seed('ATHLETE');
    await expect(service.begin(admin, 'incorrect')).rejects.toMatchObject({ status: 403 });
    await expect(service.begin(regular, password)).rejects.toMatchObject({ status: 403 });
    await expect(service.begin(athlete, password)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.begin({ ...admin, sessionId: regular.sessionId }, password),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await prisma.mfaAuthenticator.count({
        where: { userId: { in: [admin.userId, regular.userId, athlete.userId] } },
      }),
    ).toBe(0);
  });

  it('refuses revoked, expired and pending-MFA sessions', async () => {
    const revoked = await seed();
    const expired = await seed();
    const pending = await seed();
    await prisma.session.delete({ where: { id: revoked.sessionId } });
    await prisma.session.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(0) },
    });
    await prisma.session.update({ where: { id: pending.sessionId }, data: { mfa: 'pending' } });
    for (const principal of [revoked, expired, pending]) {
      await expect(service.begin(principal, password)).rejects.toMatchObject({ status: 403 });
    }
  });

  it('allows only one concurrent enrollment and never replaces a confirmed factor', async () => {
    const principal = await seed();
    const results = await Promise.allSettled([
      service.begin(principal, password),
      service.begin(principal, password),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const row = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: principal.userId },
    });
    await prisma.mfaAuthenticator.update({
      where: { userId: principal.userId },
      data: { confirmed: true },
    });
    await expect(service.begin(principal, password)).rejects.toMatchObject({ status: 409 });
    expect(
      (await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { userId: principal.userId } }))
        .secret,
    ).toBe(row.secret);
  });

  it('replaces only expired bound first enrollments', async () => {
    const principal = await seed();
    const first = await service.begin(principal, password);
    await prisma.mfaAuthenticator.update({
      where: { userId: principal.userId },
      data: { enrollmentExpiresAt: new Date(0) },
    });
    const second = await service.begin(principal, password);
    expect(second.secret).not.toBe(first.secret);
  });

  it('blocks requests when the account limiter refuses them', async () => {
    const principal = await seed();
    const limiter = app.get(AuthAccountThrottleService);
    const denied = vi
      .spyOn(limiter, 'assertAllowed')
      .mockRejectedValueOnce(new Error('test limiter refusal'));
    try {
      await expect(service.begin(principal, password)).rejects.toThrow('test limiter refusal');
      expect(await prisma.mfaAuthenticator.count({ where: { userId: principal.userId } })).toBe(0);
    } finally {
      denied.mockRestore();
    }
  });

  it('enforces the actual account limit after five failed password proofs', async () => {
    const principal = await seed();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.begin(principal, 'incorrect')).rejects.toMatchObject({ status: 403 });
    }
    await expect(service.begin(principal, password)).rejects.toMatchObject({ status: 429 });
    expect(await prisma.mfaAuthenticator.count({ where: { userId: principal.userId } })).toBe(0);
  });

  it('restricts transaction-bound factor storage to the locked owner', async () => {
    const owner = await seed();
    const other = await seed();
    await app.get(PrismaMfaStore).withLockedOwner(owner.userId, async (_tx, store) => {
      await expect(store.getTotp(other.userId)).rejects.toThrow('MFA owner mismatch');
      await expect(store.claimTotpStep(other.userId, 1)).rejects.toThrow('MFA owner mismatch');
      await expect(store.consumeRecoveryCode(other.userId, 'synthetic')).rejects.toThrow(
        'MFA owner mismatch',
      );
    });
  });

  it('rechecks session revocation after password proof and before writing', async () => {
    const principal = await seed();
    const hasher = app.get(PasswordHasher);
    const verify = hasher.verify.bind(hasher);
    const spy = vi.spyOn(hasher, 'verify').mockImplementationOnce(async (...args) => {
      const result = await verify(...args);
      await prisma.session.delete({ where: { id: principal.sessionId } });
      return result;
    });
    try {
      await expect(service.begin(principal, password)).rejects.toMatchObject({ status: 403 });
      expect(await prisma.mfaAuthenticator.count({ where: { userId: principal.userId } })).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
