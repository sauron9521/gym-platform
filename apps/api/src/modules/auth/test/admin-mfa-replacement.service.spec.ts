import { createHash } from 'node:crypto';

import { InMemoryMfaStore, MfaService } from '@nestjs/authentication';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Prisma } from '#prisma/client';
import { AdminMfaReplacementService } from '../services/admin-mfa-replacement.service.js';
import { ADMIN_MFA_METADATA } from '../stores/admin-mfa-session-scope.js';

const token = 'A'.repeat(43);
const id = createHash('sha256').update(token).digest('base64url');
const userId = 'admin-id';

function setup() {
  const fence = new Date();
  const grant = {
    id,
    userId,
    mfa: 'verified',
    createdAt: new Date(fence.getTime() - 1000),
    lastActiveAt: fence,
    expiresAt: new Date(fence.getTime() + 300_000),
    metadata: {
      ...ADMIN_MFA_METADATA,
      adminMfaMethod: 'recovery',
      adminRecoveryFence: fence.toISOString(),
    },
    user: { email: 'admin@example.test', passwordHash: 'hash', authInvalidatedAt: fence },
  };
  const factor = {
    confirmed: true,
    pendingSecret: null as string | null,
    enrollmentSessionId: null as string | null,
    enrollmentExpiresAt: null as Date | null,
  };
  const tx = {
    session: {
      findFirst: vi.fn().mockResolvedValue(grant),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    mfaAuthenticator: {
      findUnique: vi.fn().mockResolvedValue(factor),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    refreshTokenFamily: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mfaLifecycleAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit-id', occurredAt: new Date() }),
    },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([{ id }]),
  };
  const store = new InMemoryMfaStore();
  type Work = (client: Prisma.TransactionClient, mfa: InMemoryMfaStore) => Promise<unknown>;
  const factors = {
    withLockedOwner: vi.fn((_owner: string, work: Work) =>
      work(tx as unknown as Prisma.TransactionClient, store),
    ),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(true) };
  const throttle = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
  const keyring = createHash('sha256').update('replacement test fixture').digest('base64url');
  const config = {
    get: vi.fn().mockReturnValue(keyring),
    getOrThrow: vi.fn().mockReturnValue('independent-test-signing-secret'),
  };
  const service = new AdminMfaReplacementService(
    tx as never,
    factors as never,
    passwords as never,
    throttle as never,
    config as never,
  );
  return { service, tx, grant, factor, factors, passwords, config };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AdminMfaReplacementService', () => {
  it('requires configured encryption and valid input', async () => {
    const { service, config, tx } = setup();
    config.get.mockReturnValueOnce(undefined);
    await expect(service.begin(token, 'password')).rejects.toMatchObject({ status: 503 });
    expect(await service.begin('invalid', 'password')).toBeNull();
    expect(await service.confirm(token, 'password', 'invalid')).toBeNull();
    expect(tx.session.findFirst).not.toHaveBeenCalled();
  });

  it('rejects absent, expired and normal TOTP sessions before password verification', async () => {
    const { service, tx, grant, passwords } = setup();
    tx.session.findFirst.mockResolvedValueOnce(null);
    expect(await service.begin(token, 'password')).toBeNull();
    tx.session.findFirst.mockResolvedValueOnce({ ...grant, expiresAt: new Date(0) });
    expect(await service.begin(token, 'password')).toBeNull();
    tx.session.findFirst.mockResolvedValueOnce({
      ...grant,
      metadata: { ...ADMIN_MFA_METADATA, adminMfaMethod: 'totp' },
    });
    expect(await service.begin(token, 'password')).toBeNull();
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('requires fresh password and revalidates the same grant under the lock', async () => {
    const { service, tx, grant, factors, passwords } = setup();
    passwords.verify.mockResolvedValueOnce(false);
    expect(await service.begin(token, 'password')).toBeNull();
    expect(factors.withLockedOwner).not.toHaveBeenCalled();
    tx.session.findFirst.mockResolvedValueOnce(grant).mockResolvedValueOnce(null);
    expect(await service.begin(token, 'password')).toBeNull();
    expect(tx.mfaAuthenticator.findUnique).not.toHaveBeenCalled();
  });

  it('stages a library-generated candidate and binds its deadline', async () => {
    const { service, tx, grant } = setup();
    const enroll = vi.spyOn(MfaService.prototype, 'enroll').mockResolvedValueOnce({
      secret: 'test-only',
      uri: 'test-uri',
    });
    const result = await service.begin(token, 'password');
    expect(result?.secret).toBe('test-only');
    expect(enroll).toHaveBeenCalledWith(userId, grant.user.email, { replace: true });
    expect(tx.mfaAuthenticator.update).toHaveBeenCalledWith({
      where: { userId },
      data: { enrollmentSessionId: id, enrollmentExpiresAt: result?.expiresAt },
    });
    expect(tx.mfaLifecycleAudit.create).toHaveBeenCalledWith({
      data: { userId, action: 'ADMIN_TOTP_REPLACEMENT_STAGED' },
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to overwrite a live or unbound candidate', async () => {
    const { service, factor } = setup();
    const enroll = vi.spyOn(MfaService.prototype, 'enroll');
    factor.pendingSecret = 'sealed';
    expect(await service.begin(token, 'password')).toBeNull();
    factor.enrollmentSessionId = id;
    factor.enrollmentExpiresAt = new Date(Date.now() + 60_000);
    expect(await service.begin(token, 'password')).toBeNull();
    expect(enroll).not.toHaveBeenCalled();
  });

  it('requires the exact bound candidate and rejects failed confirmation', async () => {
    const { service, factor, tx } = setup();
    const confirm = vi.spyOn(MfaService.prototype, 'confirm').mockResolvedValueOnce(false);
    expect(await service.confirm(token, 'password', '123456')).toBeNull();
    factor.pendingSecret = 'sealed';
    factor.enrollmentExpiresAt = new Date(Date.now() + 60_000);
    factor.enrollmentSessionId = 'other';
    expect(await service.confirm(token, 'password', '123456')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    factor.enrollmentSessionId = id;
    expect(await service.confirm(token, 'password', '123456')).toBeNull();
    expect(confirm).toHaveBeenCalledWith(userId, '123456');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('clears binding and revokes all identity credentials after successful confirmation', async () => {
    const { service, tx, factor } = setup();
    factor.pendingSecret = 'sealed';
    factor.enrollmentSessionId = id;
    factor.enrollmentExpiresAt = new Date(Date.now() + 60_000);
    vi.spyOn(MfaService.prototype, 'confirm').mockResolvedValueOnce(true);
    const codes = ['TEST1-TEST2'];
    vi.spyOn(MfaService.prototype, 'generateRecoveryCodes').mockResolvedValueOnce(codes);
    const result = await service.confirm(token, 'password', '123456');
    expect(result).toEqual({ recoveryCodes: codes });
    expect(tx.mfaAuthenticator.update).toHaveBeenCalledWith({
      where: { userId },
      data: { enrollmentSessionId: null, enrollmentExpiresAt: null },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { authInvalidatedAt: expect.any(Date) },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(tx.refreshTokenFamily.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    expect(tx.mfaLifecycleAudit.create).toHaveBeenCalledWith({
      data: { userId, action: 'ADMIN_TOTP_REPLACEMENT_CONFIRMED' },
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('fails closed if the candidate expires during code generation', async () => {
    vi.useFakeTimers();
    const { service, factor, tx } = setup();
    factor.pendingSecret = 'sealed';
    factor.enrollmentSessionId = id;
    const deadline = new Date(Date.now() + 60_000);
    factor.enrollmentExpiresAt = deadline;
    vi.spyOn(MfaService.prototype, 'confirm').mockResolvedValueOnce(true);
    vi.spyOn(MfaService.prototype, 'generateRecoveryCodes').mockImplementationOnce(() => {
      vi.setSystemTime(deadline);
      return Promise.resolve(['TEST1-TEST2']);
    });
    const result = service.confirm(token, 'password', '123456');
    await expect(result).rejects.toThrow('Administrative replacement grant expired');
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
