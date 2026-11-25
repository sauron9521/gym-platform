import { createHash } from 'node:crypto';

import { InMemoryMfaStore, MfaService } from '@nestjs/authentication';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Prisma } from '#prisma/client';
import { AdminMfaRecoveryService } from '../services/admin-mfa-recovery.service.js';
import { AUTH_ACCOUNT_THROTTLE_POLICIES } from '../services/auth-account-throttle.service.js';
import { ADMIN_MFA_METADATA, adminMfaSessionScope } from '../stores/admin-mfa-session-scope.js';

const token = 'A'.repeat(43);
const id = createHash('sha256').update(token).digest('base64url');
const userId = 'admin-id';

function setup() {
  const now = new Date();
  const row = {
    id,
    userId,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + 600_000),
    mfa: 'verified',
    metadata: ADMIN_MFA_METADATA,
    user: { passwordHash: 'hash', authInvalidatedAt: null },
  };
  const tx = {
    session: {
      findFirst: vi.fn().mockResolvedValue(row),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    refreshTokenFamily: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mfaLifecycleAudit: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([{ id }]),
  };
  const store = new InMemoryMfaStore();
  type Work = (client: Prisma.TransactionClient, factorStore: InMemoryMfaStore) => Promise<unknown>;
  const factors = {
    withLockedOwner: vi.fn((_owner: string, work: Work) =>
      work(tx as unknown as Prisma.TransactionClient, store),
    ),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(true) };
  const throttle = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
  const keyring = createHash('sha256').update('unit test recovery key').digest('base64url');
  const config = {
    get: vi.fn().mockReturnValue(keyring),
    getOrThrow: vi.fn().mockReturnValue('independent-test-signing-secret'),
  };
  const service = new AdminMfaRecoveryService(
    tx as never,
    factors as never,
    passwords as never,
    throttle as never,
    config as never,
  );
  return { service, tx, row, factors, passwords, throttle, config };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AdminMfaRecoveryService', () => {
  it('fails closed without encryption configuration', async () => {
    const { service, config, tx } = setup();
    config.get.mockReturnValue(undefined);
    const result = service.regenerate(token, 'password', '123456');
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(tx.session.findFirst).not.toHaveBeenCalled();
  });

  it('rejects malformed proofs and missing sessions before opening a transaction', async () => {
    const { service, tx, factors } = setup();
    expect(await service.regenerate('invalid', 'password', '123456')).toBeNull();
    expect(await service.regenerate(token, 'password', 'ABCDE-FGHIJ')).toBeNull();
    expect(tx.session.findFirst).not.toHaveBeenCalled();
    tx.session.findFirst.mockResolvedValueOnce(null);
    expect(await service.regenerate(token, 'password', '123456')).toBeNull();
    expect(factors.withLockedOwner).not.toHaveBeenCalled();
  });

  it('requires password verification and a separate account limit', async () => {
    const { service, factors, passwords, throttle } = setup();
    passwords.verify.mockResolvedValueOnce(false);
    expect(await service.regenerate(token, 'wrong', '123456')).toBeNull();
    expect(throttle.assertAllowed).toHaveBeenCalledWith(
      userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaRecoveryRegenerate,
    );
    expect(factors.withLockedOwner).not.toHaveBeenCalled();
  });

  it.each(['expired', 'fenced'] as const)('rejects a %s session', async (kind) => {
    const { service, tx, row, passwords } = setup();
    const invalid =
      kind === 'expired'
        ? { ...row, expiresAt: new Date(0) }
        : { ...row, user: { ...row.user, authInvalidatedAt: row.createdAt } };
    tx.session.findFirst.mockResolvedValueOnce(invalid);
    expect(await service.regenerate(token, 'password', '123456')).toBeNull();
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it.each(['missing', 'owner', 'password', 'fence'] as const)(
    'rejects a changed %s after locking',
    async (kind) => {
      const { service, tx, row } = setup();
      const verify = vi.spyOn(MfaService.prototype, 'verifyTotp');
      let current = { ...row, user: { ...row.user } };
      if (kind === 'owner') current.userId = 'other';
      if (kind === 'password') current.user.passwordHash = 'changed';
      if (kind === 'fence') {
        current = { ...current, createdAt: new Date(Date.now() + 1000) };
        tx.session.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce({
          ...current,
          user: { ...current.user, authInvalidatedAt: new Date() },
        });
      } else {
        tx.session.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(
          kind === 'missing' ? null : current,
        );
      }
      expect(await service.regenerate(token, 'password', '123456')).toBeNull();
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it('commits failure accounting but does not regenerate after invalid TOTP', async () => {
    const { service, tx } = setup();
    const verify = vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(false);
    const generate = vi.spyOn(MfaService.prototype, 'generateRecoveryCodes');
    expect(await service.regenerate(token, 'password', '123456')).toBeNull();
    expect(verify).toHaveBeenCalledWith(userId, '123456');
    expect(generate).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });

  it('replaces codes and invalidates all credentials with a durable audit', async () => {
    const { service, tx } = setup();
    vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(true);
    const codes = ['TEST1-TEST2'];
    vi.spyOn(MfaService.prototype, 'generateRecoveryCodes').mockResolvedValueOnce(codes);
    expect(await service.regenerate(token, 'password', '123456')).toEqual({
      recoveryCodes: codes,
    });
    expect(tx.session.findFirst).toHaveBeenCalledWith({
      where: {
        ...adminMfaSessionScope(id),
        mfa: 'verified',
        user: {
          role: 'ADMIN',
          status: 'ACTIVE',
          deletedAt: null,
          mfaAuthenticator: { is: { confirmed: true, pendingSecret: null } },
        },
      },
      select: expect.any(Object),
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
      data: { userId, action: 'ADMIN_RECOVERY_CODES_REGENERATED' },
    });
  });

  it('rejects a password proof older than five minutes before verifying TOTP', async () => {
    vi.useFakeTimers();
    const { service, row, passwords, tx } = setup();
    passwords.verify.mockImplementationOnce(() => {
      vi.setSystemTime(row.createdAt.getTime() + 300_000);
      return Promise.resolve(true);
    });
    const verify = vi.spyOn(MfaService.prototype, 'verifyTotp');
    expect(await service.regenerate(token, 'password', '123456')).toBeNull();
    expect(verify).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('throws if the session or proof expires while hashing new codes', async () => {
    vi.useFakeTimers();
    const { service, tx, row } = setup();
    vi.spyOn(MfaService.prototype, 'verifyTotp').mockResolvedValueOnce(true);
    vi.spyOn(MfaService.prototype, 'generateRecoveryCodes').mockImplementationOnce(() => {
      vi.setSystemTime(row.expiresAt);
      return Promise.resolve(['TEST1-TEST2']);
    });
    const result = service.regenerate(token, 'password', '123456');
    await expect(result).rejects.toThrow('Administrative recovery proof expired');
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
