import { createHash, randomUUID } from 'node:crypto';

import { MfaService, PasswordHasher, SessionService } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../../src/infra/database/index.js';
import { AdminMfaChallengeService } from '../../../src/modules/auth/services/admin-mfa-challenge.service.js';
import { AdminMfaReplacementService } from '../../../src/modules/auth/services/admin-mfa-replacement.service.js';
import { AdminMfaRecoveryService } from '../../../src/modules/auth/services/admin-mfa-recovery.service.js';
import { AdminMfaEnrollmentService } from '../../../src/modules/auth/services/admin-mfa-enrollment.service.js';
import {
  PrismaMfaStore,
  PrismaSessionStore,
  PrismaTokenStore,
} from '../../../src/modules/auth/stores/index.js';
import { UsersAuthFacade } from '../../../src/modules/users/services/users-auth.facade.js';
import { AuthAccountThrottleService } from '../../../src/modules/auth/services/auth-account-throttle.service.js';
import { recordMfaSecurityEvent } from '../../../src/modules/auth/services/record-mfa-security-event.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';
import { codeAt } from '../../utility/totp-code.js';

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
    const users = await prisma?.user.findMany({
      where: { email: { endsWith: `@${domain}` } },
      select: { id: true },
    });
    await prisma?.outboxEvent.deleteMany({
      where: { actorUserId: { in: users?.map((user) => user.id) ?? [] } },
    });
    await prisma?.mfaLifecycleAudit.deleteMany({
      where: { userId: { in: users?.map((user) => user.id) ?? [] } },
    });
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

// Simulate an authenticator independently of the production library (RFC 6238).
async function addSession(userId: string, purpose: string) {
  const now = new Date();
  const id = randomUUID();
  await prisma.session.create({
    data: {
      id,
      userId,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + 3_600_000),
      metadata: { purpose },
    },
  });
  return id;
}

describe('Admin first MFA confirmation (internal, PostgreSQL)', () => {
  it('atomically confirms, hashes recovery codes, audits, and invalidates prior credentials', async () => {
    const principal = await seed();
    const other = await seed();
    await addSession(principal.userId, 'admin');
    await addSession(principal.userId, 'web');
    const now = new Date();
    const expires = new Date(now.getTime() + 3_600_000);
    const familyId = randomUUID();
    await prisma.refreshTokenFamily.create({
      data: { id: familyId, userId: principal.userId, familyExpiresAt: expires },
    });
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        familyId,
        userId: principal.userId,
        createdAt: now,
        expiresAt: expires,
        familyExpiresAt: expires,
      },
    });

    const enrollment = await service.begin(principal, password);
    const code = codeAt(enrollment.secret);
    const result = await service.confirm(principal, code);
    expect(result?.recoveryCodes).toHaveLength(10);
    const row = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: principal.userId },
    });
    expect(row.confirmed).toBe(true);
    expect(row.lastUsedStep).not.toBeNull();
    expect(row.enrollmentSessionId).toBeNull();
    expect(row.enrollmentExpiresAt).toBeNull();
    const hashes = await prisma.mfaRecoveryCode.findMany({ where: { userId: principal.userId } });
    expect(hashes).toHaveLength(10);
    for (const entry of hashes) {
      expect(entry.hash).toMatch(/^rc1\./);
      expect(result?.recoveryCodes).not.toContain(entry.hash);
    }
    expect(await prisma.session.count({ where: { userId: principal.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: other.userId } })).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: principal.userId } })).authInvalidatedAt,
    ).not.toBeNull();
    expect(
      (await prisma.refreshTokenFamily.findUniqueOrThrow({ where: { id: familyId } })).revokedAt,
    ).not.toBeNull();
    expect(
      await prisma.refreshToken.count({ where: { userId: principal.userId, revoked: false } }),
    ).toBe(0);
    const audit = await prisma.mfaLifecycleAudit.findMany({ where: { userId: principal.userId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('FIRST_TOTP_CONFIRMED');
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: `mfa-lifecycle:${audit[0]!.id}:v1` },
    });
    expect(event.status).toBe('PENDING');
    expect(event.attemptCount).toBe(0);
    expect(event.type).toBe('account.security.changed');
    expect(event.schemaVersion).toBe(1);
    expect(event.actorUserId).toBe(principal.userId);
    expect(event.payload).toEqual({
      aggregate: { kind: 'MfaLifecycleAudit', id: audit[0]!.id },
      context: { userId: principal.userId, action: 'FIRST_TOTP_CONFIRMED' },
    });
    expect(JSON.stringify(audit)).not.toContain(enrollment.secret);
    await expect(service.confirm(principal, code)).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a different session, expired enrollment, or missing enrollment', async () => {
    const principal = await seed();
    await expect(service.confirm(principal, '123456')).rejects.toMatchObject({ status: 403 });
    const enrollment = await service.begin(principal, password);
    const second = await addSession(principal.userId, 'admin');
    await expect(
      service.confirm({ ...principal, sessionId: second }, codeAt(enrollment.secret)),
    ).rejects.toMatchObject({ status: 403 });
    await prisma.mfaAuthenticator.update({
      where: { userId: principal.userId },
      data: { enrollmentExpiresAt: new Date(0) },
    });
    await expect(service.confirm(principal, codeAt(enrollment.secret))).rejects.toMatchObject({
      status: 403,
    });
    expect(await prisma.mfaLifecycleAudit.count({ where: { userId: principal.userId } })).toBe(0);
  });

  it('commits invalid-code attempt accounting without activation', async () => {
    const principal = await seed();
    const enrollment = await service.begin(principal, password);
    const step = Math.floor(Date.now() / 30_000);
    const valid = new Set(
      [-2, -1, 0, 1, 2].map((offset) => codeAt(enrollment.secret, step + offset)),
    );
    const wrong = Array.from({ length: 10 }, (_, i) => String(i).padStart(6, '0')).find(
      (code) => !valid.has(code),
    )!;
    for (let i = 0; i < 5; i += 1) {
      expect(await service.confirm(principal, wrong)).toBeNull();
    }
    expect(await prisma.mfaFailure.count({ where: { userId: principal.userId } })).toBe(5);
    await expect(service.confirm(principal, codeAt(enrollment.secret))).rejects.toMatchObject({
      status: 429,
    });
    expect(
      (await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { userId: principal.userId } }))
        .confirmed,
    ).toBe(false);
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: principal.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: principal.userId } })).toBe(1);
  });

  it('issues just one recovery batch and one audit on concurrent confirmation', async () => {
    const principal = await seed();
    const enrollment = await service.begin(principal, password);
    const code = codeAt(enrollment.secret);
    const results = await Promise.allSettled([
      service.confirm(principal, code),
      service.confirm(principal, code),
    ]);
    expect(
      results.filter((r) => r.status === 'fulfilled' && r.value?.recoveryCodes.length === 10),
    ).toHaveLength(1);
    expect(await prisma.mfaLifecycleAudit.count({ where: { userId: principal.userId } })).toBe(1);
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: principal.userId } })).toBe(10);
  });

  it('rolls back confirmation and replay claim if recovery issuance fails', async () => {
    const principal = await seed();
    const enrollment = await service.begin(principal, password);
    const failure = vi
      .spyOn(MfaService.prototype, 'generateRecoveryCodes')
      .mockRejectedValueOnce(new Error('test rollback'));
    try {
      await expect(service.confirm(principal, codeAt(enrollment.secret))).rejects.toThrow(
        'test rollback',
      );
      const row = await prisma.mfaAuthenticator.findUniqueOrThrow({
        where: { userId: principal.userId },
      });
      expect(row.confirmed).toBe(false);
      expect(row.lastUsedStep).toBeNull();
      expect(row.enrollmentSessionId).toBe(principal.sessionId);
      expect(await prisma.mfaRecoveryCode.count({ where: { userId: principal.userId } })).toBe(0);
      expect(await prisma.mfaLifecycleAudit.count({ where: { userId: principal.userId } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: principal.userId } })).toBe(1);
    } finally {
      failure.mockRestore();
    }
  });
});

describe('Confirmed-factor password-only credential boundary (PostgreSQL)', () => {
  it('denies existing and new credentials for confirmed factors, even with MFA disabled', async () => {
    const principal = await seed();
    const other = await seed();
    const sessions = app.get(PrismaSessionStore);
    const tokens = app.get(PrismaTokenStore);
    const users = app.get(UsersAuthFacade);
    const enrollment = await service.begin(principal, password);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3_600_000);
    const refresh = {
      id: randomUUID(),
      familyId: randomUUID(),
      userId: principal.userId,
      createdAt: now,
      expiresAt,
      familyExpiresAt: expiresAt,
    };

    // Unconfirmed enrollment must not block ordinary credentials.
    expect(await sessions.getSession(principal.sessionId)).toBeDefined();
    expect(
      await users.findUserForJwtAuth(principal.userId, Math.floor(Date.now() / 1000)),
    ).not.toBeNull();
    await tokens.saveRefreshToken(refresh);
    expect(await tokens.getRefreshToken(refresh.id)).toBeDefined();

    // Simulate a surviving credential row from an earlier deployment. The
    // real confirmation service also revokes credentials in its transaction.
    await prisma.mfaAuthenticator.update({
      where: { userId: principal.userId },
      data: { confirmed: true },
    });
    expect(enrollment.secret).toBeDefined();
    expect(await sessions.getSession(principal.sessionId)).toBeUndefined();
    expect(await tokens.getRefreshToken(refresh.id)).toBeUndefined();
    expect(await tokens.markRefreshTokenUsed(refresh.id, new Date())).toBe(false);
    expect(
      await users.findUserForJwtAuth(principal.userId, Math.floor(Date.now() / 1000)),
    ).toBeNull();

    await expect(
      sessions.createSession({
        id: randomUUID(),
        userId: principal.userId,
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        metadata: { purpose: 'admin' },
      }),
    ).rejects.toThrow('MFA authentication required');
    await expect(tokens.saveRefreshToken({ ...refresh, id: randomUUID() })).rejects.toThrow(
      'MFA authentication required',
    );
    expect(await sessions.getSession(other.sessionId)).toBeDefined();
    expect(
      await users.findUserForJwtAuth(other.userId, Math.floor(Date.now() / 1000)),
    ).not.toBeNull();
  });
});

describe('Internal Admin MFA challenge (PostgreSQL)', () => {
  async function enrolled() {
    const principal = await seed();
    const enrollment = await service.begin(principal, password);
    const confirmed = await service.confirm(
      principal,
      codeAt(enrollment.secret, Math.floor(Date.now() / 30_000) - 1),
    );
    if (!confirmed) throw new Error('Test enrollment failed');
    return { ...principal, secret: enrollment.secret, recoveryCodes: confirmed.recoveryCodes };
  }

  it('issues a bounded pending session and rotates to a new verified Admin token', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    expect(await challenge.begin(owner.userId, 'incorrect')).toBeNull();
    const pending = await challenge.begin(owner.userId, password);
    expect(pending?.session.mfa).toBe('pending');
    expect(pending?.cookie).toContain('__Host-admin-sid=');
    const pendingTtl = pending!.session.expiresAt.getTime() - pending!.session.createdAt.getTime();
    expect(pendingTtl).toBeLessThanOrEqual(300_000);
    expect(await app.get(PrismaSessionStore).getSession(pending!.session.id)).toBeUndefined();

    const verified = await challenge.complete(pending!.token, { code: codeAt(owner.secret) });
    expect(verified?.session.mfa).toBe('verified');
    expect(verified?.session.metadata?.adminMfaMethod).toBe('totp');
    const persisted = await prisma.session.findUniqueOrThrow({
      where: { id: verified!.session.id },
    });
    expect(persisted.metadata).toMatchObject({ adminMfaMethod: 'totp' });
    expect(verified?.token).not.toBe(pending!.token);
    expect(verified?.session.createdAt).toEqual(pending!.session.createdAt);
    const verifiedSession = verified!.session;
    const verifiedTtl = verifiedSession.expiresAt.getTime() - verifiedSession.createdAt.getTime();
    expect(verifiedTtl).toBe(8 * 60 * 60 * 1000);
    expect(await prisma.session.findUnique({ where: { id: pending!.session.id } })).toBeNull();
    expect(await app.get(PrismaSessionStore).getSession(verified!.session.id)).toBeUndefined();
    expect(await challenge.complete(pending!.token, { code: codeAt(owner.secret) })).toBeNull();
    expect(
      await prisma.mfaLifecycleAudit.count({
        where: { userId: owner.userId, action: 'ADMIN_TOTP_CHALLENGE_VERIFIED' },
      }),
    ).toBe(1);
  });

  it('consumes a recovery code once across concurrent pending sessions', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    const first = (await challenge.begin(owner.userId, password))!;
    const second = (await challenge.begin(owner.userId, password))!;
    const proof = { recoveryCode: owner.recoveryCodes[0]! };
    expect(first.session.id).not.toBe(second.session.id);
    const other = await seed();
    await addSession(owner.userId, 'web');
    const expires = new Date(Date.now() + 3_600_000);
    const familyId = randomUUID();
    await prisma.refreshTokenFamily.create({
      data: { id: familyId, userId: owner.userId, familyExpiresAt: expires },
    });
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        familyId,
        userId: owner.userId,
        createdAt: new Date(),
        expiresAt: expires,
        familyExpiresAt: expires,
      },
    });
    expect(
      await prisma.session.count({
        where: { id: { in: [first.session.id, second.session.id] }, mfa: 'pending' },
      }),
    ).toBe(2);
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: owner.userId } })).toBe(10);
    const verifier = vi.spyOn(MfaService.prototype, 'verifyRecoveryCode');
    try {
      const results = await Promise.all([
        challenge.complete(first.token, proof),
        challenge.complete(second.token, proof),
      ]);
      expect(verifier).toHaveBeenCalledTimes(1);
      expect(results.filter(Boolean)).toHaveLength(1);
      const winner = results.find(Boolean);
      expect(winner?.session.metadata?.adminMfaMethod).toBe('recovery');
      const persisted = await prisma.session.findUniqueOrThrow({
        where: { id: winner!.session.id },
      });
      const account = await prisma.user.findUniqueOrThrow({
        where: { id: owner.userId },
      });
      expect(persisted.metadata).toMatchObject({
        adminMfaMethod: 'recovery',
        adminRecoveryFence: account.authInvalidatedAt!.toISOString(),
      });
      expect(persisted.expiresAt.getTime() - persisted.createdAt.getTime()).toBe(600_000);
      expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(1);
      expect(await prisma.session.count({ where: { userId: other.userId } })).toBe(1);
      const family = await prisma.refreshTokenFamily.findUniqueOrThrow({
        where: { id: familyId },
      });
      expect(family.revokedAt).not.toBeNull();
      expect(
        await prisma.refreshToken.count({ where: { userId: owner.userId, revoked: false } }),
      ).toBe(0);
    } finally {
      verifier.mockRestore();
    }
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: owner.userId } })).toBe(9);
    expect(
      await prisma.mfaLifecycleAudit.count({
        where: { userId: owner.userId, action: 'ADMIN_RECOVERY_CHALLENGE_VERIFIED' },
      }),
    ).toBe(1);
  });

  it('refuses expired, revoked, malformed and non-Admin challenges', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const proof = { recoveryCode: owner.recoveryCodes[0]! };
    expect(await challenge.complete(pending.token, { ...proof, code: '123456' })).toBeNull();
    await prisma.session.update({
      where: { id: pending.session.id },
      data: { expiresAt: new Date(0) },
    });
    expect(await challenge.complete(pending.token, proof)).toBeNull();
    await prisma.session.delete({ where: { id: pending.session.id } });
    expect(await challenge.complete(pending.token, proof)).toBeNull();
    await prisma.user.update({ where: { id: owner.userId }, data: { role: 'ATHLETE' } });
    expect(await challenge.begin(owner.userId, password)).toBeNull();
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: owner.userId } })).toBe(10);
  });

  it('rolls back recovery consumption if verified session rotation fails', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const proof = { recoveryCode: owner.recoveryCodes[0]! };
    const failure = vi.spyOn(SessionService.prototype, 'rotate').mockResolvedValueOnce(null);
    try {
      await expect(challenge.complete(pending.token, proof)).rejects.toThrow(
        'Administrative MFA session rotation failed',
      );
      expect(await prisma.mfaRecoveryCode.count({ where: { userId: owner.userId } })).toBe(10);
      const unchanged = await prisma.session.findUnique({ where: { id: pending.session.id } });
      expect(unchanged).toMatchObject({ mfa: 'pending' });
    } finally {
      failure.mockRestore();
    }
    expect((await challenge.complete(pending.token, proof))?.session.mfa).toBe('verified');
  });

  it('replaces recovery codes with fresh proof and revokes all credentials once', async () => {
    const owner = await enrolled();
    const other = await seed();
    const challenge = app.get(AdminMfaChallengeService);
    const recovery = app.get(AdminMfaRecoveryService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const verified = (await challenge.complete(pending.token, { code: codeAt(owner.secret) }))!;
    await addSession(owner.userId, 'web');
    const oldHashes = await prisma.mfaRecoveryCode.findMany({
      where: { userId: owner.userId },
    });
    const now = new Date();
    const expires = new Date(now.getTime() + 3_600_000);
    const familyId = randomUUID();
    await prisma.refreshTokenFamily.create({
      data: { id: familyId, userId: owner.userId, familyExpiresAt: expires },
    });
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        familyId,
        userId: owner.userId,
        createdAt: now,
        expiresAt: expires,
        familyExpiresAt: expires,
      },
    });
    const factor = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    const code = codeAt(owner.secret, factor.lastUsedStep! + 1);
    expect(await recovery.regenerate(pending.token, password, code)).toBeNull();
    expect(await recovery.regenerate(verified.token, 'wrong', code)).toBeNull();
    const results = await Promise.all([
      recovery.regenerate(verified.token, password, code),
      recovery.regenerate(verified.token, password, code),
    ]);
    const successful = results.filter((result) => result !== null);
    expect(successful).toHaveLength(1);
    expect(successful[0]?.recoveryCodes).toHaveLength(10);
    const hashes = await prisma.mfaRecoveryCode.findMany({ where: { userId: owner.userId } });
    expect(hashes).toHaveLength(10);
    expect(hashes.every((entry) => entry.hash.startsWith('rc1.'))).toBe(true);
    expect(hashes.some((entry) => oldHashes.some((old) => old.hash === entry.hash))).toBe(false);
    expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: other.userId } })).toBe(1);
    const family = await prisma.refreshTokenFamily.findUniqueOrThrow({ where: { id: familyId } });
    expect(family.revokedAt).not.toBeNull();
    expect(
      await prisma.refreshToken.count({ where: { userId: owner.userId, revoked: false } }),
    ).toBe(0);
    expect(
      await prisma.mfaLifecycleAudit.count({
        where: { userId: owner.userId, action: 'ADMIN_RECOVERY_CODES_REGENERATED' },
      }),
    ).toBe(1);
    const next = (await challenge.begin(owner.userId, password))!;
    expect(
      await challenge.complete(next.token, { recoveryCode: owner.recoveryCodes[1]! }),
    ).toBeNull();
    expect(
      (await challenge.complete(next.token, { recoveryCode: successful[0]!.recoveryCodes[0]! }))
        ?.session.mfa,
    ).toBe('verified');
  });

  it('rolls back the TOTP replay claim when replacement generation fails', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    const recovery = app.get(AdminMfaRecoveryService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const verified = (await challenge.complete(pending.token, { code: codeAt(owner.secret) }))!;
    const before = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    const hashes = await prisma.mfaRecoveryCode.findMany({ where: { userId: owner.userId } });
    const failure = vi
      .spyOn(MfaService.prototype, 'generateRecoveryCodes')
      .mockRejectedValueOnce(new Error('injected generation failure'));
    const code = codeAt(owner.secret, before.lastUsedStep! + 1);
    try {
      await expect(recovery.regenerate(verified.token, password, code)).rejects.toThrow(
        'injected generation failure',
      );
    } finally {
      failure.mockRestore();
    }
    const after = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(after.lastUsedStep).toBe(before.lastUsedStep);
    expect(await prisma.mfaRecoveryCode.findMany({ where: { userId: owner.userId } })).toEqual(
      hashes,
    );
    expect(await prisma.session.findUnique({ where: { id: verified.session.id } })).not.toBeNull();
    expect(
      await prisma.mfaLifecycleAudit.count({
        where: { userId: owner.userId, action: 'ADMIN_RECOVERY_CODES_REGENERATED' },
      }),
    ).toBe(0);
    const retried = await recovery.regenerate(verified.token, password, code);
    expect(retried?.recoveryCodes).toHaveLength(10);
  });

  it('replaces a lost TOTP only after confirming the bound candidate', async () => {
    const owner = await enrolled();
    const other = await seed();
    const challenge = app.get(AdminMfaChallengeService);
    const replacement = app.get(AdminMfaReplacementService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const grant = (await challenge.complete(pending.token, {
      recoveryCode: owner.recoveryCodes[0]!,
    }))!;
    const before = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(await replacement.begin(pending.token, password)).toBeNull();
    expect(await replacement.begin(grant.token, 'wrong')).toBeNull();
    const staged = (await replacement.begin(grant.token, password))!;
    expect(staged.uri).toMatch(/^otpauth:\/\/totp\//);
    const candidate = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(candidate.secret).toBe(before.secret);
    expect(candidate.confirmed).toBe(true);
    expect(candidate.pendingSecret).toMatch(/^v1\./);
    expect(candidate.pendingSecret).not.toContain(staged.secret);
    expect(candidate.enrollmentSessionId).toBe(grant.session.id);
    expect(candidate.enrollmentExpiresAt).toEqual(staged.expiresAt);
    expect(await replacement.begin(grant.token, password)).toBeNull();

    const step = Math.floor(Date.now() / 30_000);
    const candidateCodes = new Set([-2, -1, 0, 1, 2].map((n) => codeAt(staged.secret, step + n)));
    const wrong = Array.from({ length: 10 }, (_, i) => String(i).padStart(6, '0')).find(
      (code) => !candidateCodes.has(code),
    )!;
    expect(await replacement.confirm(grant.token, password, wrong)).toBeNull();
    expect(await prisma.mfaFailure.count({ where: { userId: owner.userId } })).toBe(1);
    const code = codeAt(staged.secret);
    const results = await Promise.all([
      replacement.confirm(grant.token, password, code),
      replacement.confirm(grant.token, password, code),
    ]);
    const winner = results.find((result) => result !== null);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(winner?.recoveryCodes).toHaveLength(10);
    const updated = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(updated.secret).not.toBe(before.secret);
    expect(updated.pendingSecret).toBeNull();
    expect(updated.enrollmentSessionId).toBeNull();
    expect(updated.enrollmentExpiresAt).toBeNull();
    expect(updated.confirmed).toBe(true);
    expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: other.userId } })).toBe(1);
    expect(await replacement.confirm(grant.token, password, code)).toBeNull();
    const audit = await prisma.mfaLifecycleAudit.findMany({ where: { userId: owner.userId } });
    expect(audit.filter((row) => row.action === 'ADMIN_TOTP_REPLACEMENT_CONFIRMED')).toHaveLength(
      1,
    );
    const events = await prisma.outboxEvent.findMany({
      where: { actorUserId: owner.userId },
    });
    expect(events).toHaveLength(4);
    for (const event of events) {
      expect(event.status).toBe('PENDING');
      expect(event.attemptCount).toBe(0);
      expect(JSON.stringify(event.payload)).not.toContain(staged.secret);
    }
    expect(JSON.stringify(audit)).not.toContain(staged.secret);

    const next = (await challenge.begin(owner.userId, password))!;
    expect(
      await challenge.complete(next.token, { recoveryCode: owner.recoveryCodes[1]! }),
    ).toBeNull();
    const nextCode = codeAt(staged.secret, updated.lastUsedStep! + 1);
    expect((await challenge.complete(next.token, { code: nextCode }))?.session.mfa).toBe(
      'verified',
    );
  });

  it('does not activate an expired replacement or lose the original factor on failure', async () => {
    const owner = await enrolled();
    const challenge = app.get(AdminMfaChallengeService);
    const replacement = app.get(AdminMfaReplacementService);
    const pending = (await challenge.begin(owner.userId, password))!;
    const grant = (await challenge.complete(pending.token, {
      recoveryCode: owner.recoveryCodes[0]!,
    }))!;
    const staged = (await replacement.begin(grant.token, password))!;
    const before = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    const code = codeAt(staged.secret);
    const failure = vi
      .spyOn(MfaService.prototype, 'generateRecoveryCodes')
      .mockRejectedValueOnce(new Error('injected replacement failure'));
    try {
      await expect(replacement.confirm(grant.token, password, code)).rejects.toThrow(
        'injected replacement failure',
      );
    } finally {
      failure.mockRestore();
    }
    const after = await prisma.mfaAuthenticator.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(after).toEqual(before);
    await prisma.mfaAuthenticator.update({
      where: { userId: owner.userId },
      data: { enrollmentExpiresAt: new Date(0) },
    });
    expect(await replacement.confirm(grant.token, password, code)).toBeNull();
    expect(
      await prisma.mfaLifecycleAudit.count({
        where: { userId: owner.userId, action: 'ADMIN_TOTP_REPLACEMENT_CONFIRMED' },
      }),
    ).toBe(0);
  });
});

describe('MFA security notice outbox (PostgreSQL)', () => {
  it('rolls back the audit and queued notice with the owner transaction', async () => {
    const owner = await seed();
    const store = app.get(PrismaMfaStore);
    await expect(
      store.withLockedOwner(owner.userId, async (tx) => {
        await recordMfaSecurityEvent(tx, owner.userId, 'ADMIN_TOTP_REPLACEMENT_STAGED');
        throw new Error('injected lifecycle rollback');
      }),
    ).rejects.toThrow('injected lifecycle rollback');
    expect(await prisma.mfaLifecycleAudit.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { actorUserId: owner.userId } })).toBe(0);
  });

  it('enforces uniqueness of the persisted transition key', async () => {
    const owner = await seed();
    await app.get(PrismaMfaStore).withLockedOwner(owner.userId, async (tx) => {
      await recordMfaSecurityEvent(tx, owner.userId, 'ADMIN_RECOVERY_CODES_REGENERATED');
    });
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { actorUserId: owner.userId },
    });
    const duplicate = {
      eventKey: event.eventKey,
      type: event.type,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt,
      actorUserId: owner.userId,
      payload: { aggregate: { kind: 'MfaLifecycleAudit' }, context: {} },
    };
    await expect(prisma.outboxEvent.create({ data: duplicate })).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(await prisma.outboxEvent.count({ where: { actorUserId: owner.userId } })).toBe(1);
  });
});
