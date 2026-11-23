import { MfaService, PasswordHasher } from '@nestjs/authentication';
import { ForbiddenException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { DistributedThrottlerStorage } from '#src/common/rate-limit/distributed-throttler.storage';
import type { AccountDeletionRequestsRepository } from '../repositories/account-deletion-requests.repository.js';
import { AccountDeletionRequestsService } from '../services/account-deletion-requests.service.js';

const owner = 'owner-1';
const confirmation = { confirm: true as const, password: 'CurrentPassword!' };
const credentials = { passwordHash: 'stored-hash', authInvalidatedAt: null };
const receipt = { id: 'request-1', requestedAt: new Date('2026-11-23T20:00:00Z') };

function setup() {
  const repository = {
    findOwn: vi.fn().mockResolvedValue(null),
    findConfirmationCredentials: vi.fn().mockResolvedValue(credentials),
    submit: vi.fn().mockResolvedValue(receipt),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(true) };
  const mfa = {
    isEnrolled: vi.fn().mockResolvedValue(false),
    verifyTotp: vi.fn().mockResolvedValue(true),
  };
  const throttle = { increment: vi.fn().mockResolvedValue({ isBlocked: false }) };
  const service = new AccountDeletionRequestsService(
    repository as unknown as AccountDeletionRequestsRepository,
    passwords as unknown as PasswordHasher,
    mfa as unknown as MfaService,
    throttle as unknown as DistributedThrottlerStorage,
  );
  return { service, repository, passwords, mfa, throttle };
}

describe('AccountDeletionRequestsService', () => {
  it('reports only the owner’s request and its submission status', async () => {
    const { service, repository } = setup();
    await expect(service.findOwn(owner)).resolves.toEqual({ request: null });
    repository.findOwn.mockResolvedValue(receipt);
    await expect(service.findOwn(owner)).resolves.toEqual({
      request: { ...receipt, status: 'REQUESTED' },
    });
    expect(repository.findOwn).toHaveBeenCalledWith(owner);
  });

  it('checks the account budget before attempting password verification', async () => {
    const { service, repository, passwords, throttle } = setup();
    throttle.increment.mockResolvedValue({ isBlocked: true });
    await expect(service.submit(owner, confirmation)).rejects.toThrow(ThrottlerException);
    expect(throttle.increment).toHaveBeenCalledWith(
      'account-deletion:owner-1',
      60_000,
      3,
      0,
      'account-deletion',
    );
    expect(repository.findConfirmationCredentials).not.toHaveBeenCalled();
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid password or an inactive account before recording the request', async () => {
    const { service, repository, passwords, mfa } = setup();
    passwords.verify.mockResolvedValueOnce(false);
    await expect(service.submit(owner, confirmation)).rejects.toThrow(ForbiddenException);
    repository.findConfirmationCredentials.mockResolvedValue(null);
    await expect(service.submit(owner, confirmation)).rejects.toThrow(ForbiddenException);
    expect(mfa.verifyTotp).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it('requires and verifies a fresh authenticator code when enrolled', async () => {
    const { service, repository, mfa } = setup();
    mfa.isEnrolled.mockResolvedValue(true);

    await expect(service.submit(owner, confirmation)).rejects.toThrow(
      'Current authenticator code required',
    );
    mfa.verifyTotp.mockResolvedValueOnce(false);
    const withMfa = { ...confirmation, totpCode: '123456' };
    await expect(service.submit(owner, withMfa)).rejects.toThrow(ForbiddenException);
    expect(repository.submit).not.toHaveBeenCalled();

    await expect(service.submit(owner, withMfa)).resolves.toEqual({
      request: { ...receipt, status: 'REQUESTED' },
    });
    expect(mfa.verifyTotp).toHaveBeenCalledWith(owner, '123456');
    expect(repository.submit).toHaveBeenCalledExactlyOnceWith(owner, credentials);
  });

  it('refuses to confirm submission when the verified account state changed', async () => {
    const { service, repository } = setup();
    repository.submit.mockResolvedValue(null);
    await expect(service.submit(owner, confirmation)).rejects.toThrow(ForbiddenException);
    expect(repository.submit).toHaveBeenCalledExactlyOnceWith(owner, credentials);
  });
});
