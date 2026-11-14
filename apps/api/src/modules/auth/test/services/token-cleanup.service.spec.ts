import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCleanupLockService } from '../../services/auth-cleanup-lock.service.js';
import { TokenCleanupService } from '../../services/token-cleanup.service.js';
import { PrismaSessionStore, PrismaTokenStore } from '../../stores/index.js';

describe('TokenCleanupService', () => {
  let service: TokenCleanupService;
  let tokenStore: {
    deleteExpiredRefreshTokenFamiliesBatch: ReturnType<typeof vi.fn>;
    deleteExpiredEmailTokensBatch: ReturnType<typeof vi.fn>;
  };
  let sessionStore: {
    deleteExpiredSessionsBatch: ReturnType<typeof vi.fn>;
  };
  let lock: { runExclusive: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenStore = {
      deleteExpiredRefreshTokenFamiliesBatch: vi.fn().mockResolvedValue(0),
      deleteExpiredEmailTokensBatch: vi.fn().mockResolvedValue(0),
    };
    sessionStore = {
      deleteExpiredSessionsBatch: vi.fn().mockResolvedValue(0),
    };
    lock = {
      runExclusive: vi.fn().mockImplementation(async (work: () => Promise<void>) => {
        await work();
        return true;
      }),
    };
    service = new TokenCleanupService(
      tokenStore as unknown as PrismaTokenStore,
      sessionStore as unknown as PrismaSessionStore,
      lock as unknown as AuthCleanupLockService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a shared cutoff and a 500-row limit for all three tables', async () => {
    const logger = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await service.cleanupExpiredTokens();

    expect(lock.runExclusive).toHaveBeenCalledOnce();
    expect(tokenStore.deleteExpiredRefreshTokenFamiliesBatch).toHaveBeenCalledOnce();
    expect(tokenStore.deleteExpiredEmailTokensBatch).toHaveBeenCalledOnce();
    expect(sessionStore.deleteExpiredSessionsBatch).toHaveBeenCalledOnce();

    const args = tokenStore.deleteExpiredRefreshTokenFamiliesBatch.mock.calls[0];
    expect(args[0]).toBeInstanceOf(Date);
    expect(args[1]).toBe(500);
    expect(tokenStore.deleteExpiredEmailTokensBatch).toHaveBeenCalledWith(args[0], 500);
    expect(sessionStore.deleteExpiredSessionsBatch).toHaveBeenCalledWith(args[0], 500);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('AUTH_TOKEN_CLEANUP_COMPLETED'));
  });

  it('repeats full batches and reports only aggregate counts and duration', async () => {
    const logger = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    tokenStore.deleteExpiredRefreshTokenFamiliesBatch
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(3);
    tokenStore.deleteExpiredEmailTokensBatch.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    sessionStore.deleteExpiredSessionsBatch.mockResolvedValueOnce(500).mockResolvedValueOnce(1);

    await service.cleanupExpiredTokens();

    expect(tokenStore.deleteExpiredRefreshTokenFamiliesBatch).toHaveBeenCalledTimes(2);
    expect(sessionStore.deleteExpiredSessionsBatch).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith(
      expect.stringMatching(
        /AUTH_TOKEN_CLEANUP_COMPLETED refreshFamilies=503 emailTokens=2 sessions=501 batches=2 elapsedMs=\d+/,
      ),
    );
  });

  it('does not touch stores when another replica owns the advisory lock', async () => {
    const logger = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    lock.runExclusive.mockResolvedValueOnce(false);

    await service.cleanupExpiredTokens();

    expect(tokenStore.deleteExpiredRefreshTokenFamiliesBatch).not.toHaveBeenCalled();
    expect(tokenStore.deleteExpiredEmailTokensBatch).not.toHaveBeenCalled();
    expect(sessionStore.deleteExpiredSessionsBatch).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledExactlyOnceWith('AUTH_TOKEN_CLEANUP_SKIPPED_LOCK_BUSY');
  });

  it('caps maximum batches and emits a safe warning when backlog remains', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    tokenStore.deleteExpiredRefreshTokenFamiliesBatch.mockResolvedValue(500);

    await service.cleanupExpiredTokens();

    expect(tokenStore.deleteExpiredRefreshTokenFamiliesBatch).toHaveBeenCalledTimes(200);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/AUTH_TOKEN_CLEANUP_LIMIT_REACHED refreshFamilies=100000 /),
    );
  });

  it('does not expose SQL errors or token secrets when a batch fails', async () => {
    const secret = 'refresh-token-secret-do-not-log';
    const error = new Error(`Failed query WHERE token = ${secret}`);
    error.stack = `Sensitive stack ${secret}`;
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const success = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    tokenStore.deleteExpiredEmailTokensBatch.mockRejectedValueOnce(error);

    await expect(service.cleanupExpiredTokens()).resolves.toBeUndefined();

    expect(logger).toHaveBeenCalledExactlyOnceWith('AUTH_TOKEN_CLEANUP_FAILED');
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    expect(success).not.toHaveBeenCalled();
  });

  it('does not log a non-Error thrown by session cleanup', async () => {
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    sessionStore.deleteExpiredSessionsBatch.mockRejectedValueOnce('sensitive-session-token');

    await expect(service.cleanupExpiredTokens()).resolves.toBeUndefined();

    expect(logger).toHaveBeenCalledExactlyOnceWith('AUTH_TOKEN_CLEANUP_FAILED');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('sensitive-session-token');
  });

  it('fails closed without revealing connection details if the lock cannot be acquired', async () => {
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    lock.runExclusive.mockRejectedValueOnce(new Error('secret database URL'));

    await expect(service.cleanupExpiredTokens()).resolves.toBeUndefined();

    expect(tokenStore.deleteExpiredRefreshTokenFamiliesBatch).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledExactlyOnceWith('AUTH_TOKEN_CLEANUP_FAILED');
  });
});
