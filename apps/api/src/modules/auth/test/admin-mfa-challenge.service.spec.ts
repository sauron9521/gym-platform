import { createHash } from 'node:crypto';

import {
  InMemoryMfaStore,
  MfaService,
  SessionService,
  type MfaStore,
} from '@nestjs/authentication';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Prisma } from '#prisma/client';
import { ADMIN_MFA_METADATA, adminMfaSessionScope } from '../stores/admin-mfa-session-scope.js';
import { AdminMfaChallengeService } from '../services/admin-mfa-challenge.service.js';
import { AUTH_ACCOUNT_THROTTLE_POLICIES } from '../services/auth-account-throttle.service.js';

const userId = 'enrolled-admin';
const token = 'A'.repeat(43);
const id = createHash('sha256').update(token).digest('base64url');
const keyring = createHash('sha256').update('unit-test challenge key').digest('base64url');

type LockedWork = (client: Prisma.TransactionClient, store: MfaStore) => Promise<unknown>;

function setup() {
  const now = new Date();
  const row = {
    id,
    userId,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + 300_000),
    mfa: 'pending',
    metadata: { ...ADMIN_MFA_METADATA, purpose: String(ADMIN_MFA_METADATA.purpose) },
  };
  const user = { passwordHash: 'test-hash', authInvalidatedAt: null };
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
    refreshTokenFamily: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: {
      findFirst: vi.fn().mockResolvedValue(row),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    mfaLifecycleAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit-id', occurredAt: new Date() }),
    },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([{ id }]),
  };
  const mfaStore = new InMemoryMfaStore();
  const factors = {
    withLockedOwner: vi.fn((_owner: string, work: LockedWork) =>
      work(tx as unknown as Prisma.TransactionClient, mfaStore),
    ),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(true) };
  const throttle = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
  const config = {
    get: vi.fn((key: string) => (key === 'MFA_ENCRYPTION_KEYS' ? keyring : undefined)),
    getOrThrow: vi.fn((key: string) =>
      key === 'JWT_SECRET' ? 'independent-test-signing-secret' : 'https://app.example.test',
    ),
  };
  const service = new AdminMfaChallengeService(
    tx as never,
    factors as never,
    passwords as never,
    throttle as never,
    config as never,
  );
  return { service, tx, row, user, factors, passwords, throttle, config };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AdminMfaChallengeService', () => {
  it('fails closed when the keyring is not configured', async () => {
    const { service, config, tx } = setup();
    config.get.mockReturnValue(undefined);
    await expect(service.begin(userId, 'password')).rejects.toMatchObject({ status: 503 });
    const completion = service.complete(token, { code: '123456' });
    await expect(completion).rejects.toMatchObject({ status: 503 });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires an enrolled owner and password proof before opening a transaction', async () => {
    const { service, tx, factors, passwords, throttle } = setup();
    tx.user.findUnique.mockResolvedValueOnce(null);
    expect(await service.begin(userId, 'password')).toBeNull();
    expect(passwords.verify).not.toHaveBeenCalled();
    passwords.verify.mockResolvedValueOnce(false);
    expect(await service.begin(userId, 'incorrect')).toBeNull();
    expect(throttle.assertAllowed).toHaveBeenCalledWith(
      userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaSignIn,
    );
    expect(factors.withLockedOwner).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { passwordHash: 'changed', authInvalidatedAt: null },
    { passwordHash: 'test-hash', authInvalidatedAt: new Date() },
  ])('rejects a changed credential snapshot under the owner lock', async (changed) => {
    const { service, tx } = setup();
    tx.user.findUnique.mockResolvedValueOnce({
      passwordHash: 'test-hash',
      authInvalidatedAt: null,
    });
    tx.user.findUnique.mockResolvedValueOnce(changed);
    expect(await service.begin(userId, 'password')).toBeNull();
    expect(tx.session.create).not.toHaveBeenCalled();
  });

  it('issues only a pending Admin cookie with a five-minute absolute TTL', async () => {
    const { service, tx, factors } = setup();
    const result = await service.begin(userId, 'password');
    expect(result?.session.mfa).toBe('pending');
    expect(result?.cookie).toContain('__Host-admin-sid=');
    const { session } = result!;
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(300_000);
    expect(factors.withLockedOwner).toHaveBeenCalledTimes(1);
    expect(tx.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId, mfa: 'pending', metadata: ADMIN_MFA_METADATA }),
    });
  });

  it.each([
    {},
    { code: 'bad' },
    { code: '123456', recoveryCode: 'ABCDE-FGHIJ' },
    { recoveryCode: 'bad' },
  ])('rejects malformed or ambiguous proof before session lookup', async (proof) => {
    const { service, tx } = setup();
    expect(await service.complete(token, proof)).toBeNull();
    expect(tx.session.findFirst).not.toHaveBeenCalled();
  });

  it('rejects malformed and unknown tokens before touching factor material', async () => {
    const { service, tx, factors } = setup();
    expect(await service.complete('invalid', { code: '123456' })).toBeNull();
    expect(tx.session.findFirst).not.toHaveBeenCalled();
    tx.session.findFirst.mockResolvedValueOnce(null);
    expect(await service.complete(token, { code: '123456' })).toBeNull();
    expect(factors.withLockedOwner).not.toHaveBeenCalled();
  });

  it('rejects a revoked session or owner after acquiring locks', async () => {
    const { service, tx, row } = setup();
    const verifier = vi.spyOn(MfaService.prototype, 'verifyTotp');
    tx.session.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    expect(await service.complete(token, { code: '123456' })).toBeNull();
    tx.user.findUnique.mockResolvedValueOnce(null);
    expect(await service.complete(token, { code: '123456' })).toBeNull();
    expect(verifier).not.toHaveBeenCalled();
  });

  it.each(['purpose', 'expiresAt', 'pendingDeadline', 'fence'] as const)(
    'rejects invalid persisted %s before factor verification',
    async (kind) => {
      const { service, tx, row, user } = setup();
      if (kind === 'purpose') row.metadata.purpose = 'web';
      if (kind === 'expiresAt') row.expiresAt = new Date(0);
      if (kind === 'pendingDeadline') row.createdAt = new Date(Date.now() - 300_001);
      if (kind === 'fence') {
        tx.user.findUnique.mockResolvedValue({ ...user, authInvalidatedAt: row.createdAt });
      }
      const verifier = vi.spyOn(MfaService.prototype, 'verifyTotp');
      expect(await service.complete(token, { code: '123456' })).toBeNull();
      expect(verifier).not.toHaveBeenCalled();
    },
  );

  it('commits failed proof without issuing a session or writing success audit', async () => {
    const { service, tx, throttle } = setup();
    const verifier = vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(false);
    expect(await service.complete(token, { code: '123456' })).toBeNull();
    expect(verifier).toHaveBeenCalledWith(userId, '123456');
    expect(throttle.assertAllowed).toHaveBeenCalledWith(
      userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaChallenge,
    );
    expect(tx.session.create).not.toHaveBeenCalled();
    expect(tx.mfaLifecycleAudit.create).not.toHaveBeenCalled();
  });

  it.each(['totp', 'recovery'] as const)('rotates after valid %s proof', async (method) => {
    const { service, tx, row } = setup();
    const totp = vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(true);
    const recovery = vi.spyOn(MfaService.prototype, 'verifyRecoveryCode');
    recovery.mockResolvedValueOnce(true);
    const proof = method === 'totp' ? { code: '123456' } : { recoveryCode: 'ABCDE-FGHIJ' };
    const result = await service.complete(token, proof);
    expect(result?.session.mfa).toBe('verified');
    const metadata = { ...ADMIN_MFA_METADATA, adminMfaMethod: method };
    expect(result?.session.metadata).toMatchObject(metadata);
    expect(tx.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: expect.objectContaining(metadata) }),
    });
    if (method === 'recovery') {
      const fence = new Date(result!.session.metadata!.adminRecoveryFence as string);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { authInvalidatedAt: fence },
      });
      expect(tx.session.deleteMany).toHaveBeenCalledWith({
        where: { userId, id: { not: result!.session.id } },
      });
      expect(tx.refreshTokenFamily.updateMany).toHaveBeenCalledWith({
        where: { userId, revokedAt: null },
        data: { revokedAt: fence },
      });
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
      expect(result!.session.expiresAt.getTime() - row.createdAt.getTime()).toBe(600_000);
    } else {
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.refreshTokenFamily.updateMany).not.toHaveBeenCalled();
    }
    expect(result?.session.createdAt).toEqual(row.createdAt);
    expect(result?.session.id).not.toBe(id);
    expect(totp).toHaveBeenCalledTimes(method === 'totp' ? 1 : 0);
    expect(recovery).toHaveBeenCalledTimes(method === 'recovery' ? 1 : 0);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { ...adminMfaSessionScope(id), userId },
    });
    const action =
      method === 'totp' ? 'ADMIN_TOTP_CHALLENGE_VERIFIED' : 'ADMIN_RECOVERY_CHALLENGE_VERIFIED';
    expect(tx.mfaLifecycleAudit.create).toHaveBeenCalledWith({ data: { userId, action } });
    if (method === 'recovery') {
      expect(tx.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: 'mfa-lifecycle:audit-id:v1',
          type: 'account.security.changed',
          schemaVersion: 1,
          actorUserId: userId,
          payload: {
            aggregate: { kind: 'MfaLifecycleAudit', id: 'audit-id' },
            context: { userId, action },
          },
        }),
      });
    } else {
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    }
  });

  it('does not commit success if rotation loses the session', async () => {
    const { service, tx } = setup();
    vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(true);
    vi.spyOn(SessionService.prototype, 'rotate').mockResolvedValueOnce(null);
    await expect(service.complete(token, { code: '123456' })).rejects.toThrow(
      'Administrative MFA session rotation failed',
    );
    expect(tx.mfaLifecycleAudit.create).not.toHaveBeenCalled();
  });

  it('throws if the deadline passes while verifying the factor', async () => {
    vi.useFakeTimers();
    const { service, tx, row } = setup();
    vi.spyOn(MfaService.prototype, 'verifyTotp').mockImplementationOnce(() => {
      vi.setSystemTime(row.expiresAt);
      return Promise.resolve(true);
    });
    await expect(service.complete(token, { code: '123456' })).rejects.toThrow(
      'Administrative MFA challenge expired during verification',
    );
    expect(tx.session.create).not.toHaveBeenCalled();
  });
});
