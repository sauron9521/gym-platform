import type {
  AuthenticationStorage,
  EmailTokenRecord,
  RefreshTokenRecord,
} from '@nestjs/authentication';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '#src/infra/database/index';
import { PASSWORD_ONLY_OWNER_FILTER } from '#src/common/auth/password-only-owner.filter';
import { authRefreshTokenSelect } from '../selects/auth-token.select.js';
import { PrismaTokenStore } from '../stores/prisma-token.store.js';

describe('PrismaTokenStore security and persistence contracts', () => {
  const now = new Date('2026-11-14T10:00:00.000Z');
  const expiresAt = new Date('2026-11-14T11:00:00.000Z');
  const familyExpiresAt = new Date('2026-11-21T10:00:00.000Z');

  const refresh: RefreshTokenRecord = {
    id: 'opaque-token-id',
    familyId: 'refresh-family-1',
    userId: 'user-1',
    createdAt: now,
    expiresAt,
    familyExpiresAt,
    claims: { amr: ['pwd'] },
  };

  const email: EmailTokenRecord = {
    id: 'email-token-id',
    purpose: 'password-reset',
    userId: 'user-1',
    email: 'member@example.test',
    fingerprint: 'email-token-fingerprint',
    createdAt: now,
    expiresAt,
  };

  const prisma = {
    user: { findUnique: vi.fn() },
    mfaAuthenticator: { findUnique: vi.fn() },
    refreshToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    refreshTokenFamily: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const storage = { registerSource: vi.fn() };
  let store: PrismaTokenStore;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.mfaAuthenticator.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    prisma.user.findUnique.mockResolvedValue({ id: refresh.userId });
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    prisma.refreshToken.findFirst.mockResolvedValue(null);
    prisma.refreshTokenFamily.findUnique.mockResolvedValue(null);
    prisma.refreshTokenFamily.upsert.mockResolvedValue({ revokedAt: null });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailToken.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join('').includes('FROM "users"')) return [{ id: refresh.userId }];
      if (sql.join('').includes('FROM "refresh_token_families"')) return [{ revokedAt: null }];
      return [];
    });
    prisma.$executeRaw.mockResolvedValue(0);
    store = new PrismaTokenStore(
      prisma as unknown as PrismaService,
      storage as unknown as AuthenticationStorage,
    );
  });

  it('registers both token stores with the authentication storage', () => {
    expect(storage.registerSource).toHaveBeenCalledExactlyOnceWith({
      refreshTokens: store,
      emailTokens: store,
    });
  });

  it('looks up refresh tokens only for non-deleted owners and limits selected fields', async () => {
    await expect(store.getRefreshToken(refresh.id)).resolves.toBeUndefined();
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: refresh.id,
        user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
      },
      select: authRefreshTokenSelect,
    });
    expect(authRefreshTokenSelect).not.toHaveProperty('revoked');
  });

  it('maps refresh tokens without leaking persistence-only revocation data', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      ...refresh,
      usedAt: null,
      revoked: true,
    });

    const actual = await store.getRefreshToken(refresh.id);
    expect(actual).toEqual(refresh);
    expect(actual).not.toHaveProperty('revoked');
    expect(actual).not.toHaveProperty('usedAt');
  });

  it('never mints refresh credentials for a suspended or missing account', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(store.saveRefreshToken(refresh)).rejects.toThrow('Account unavailable');
    expect(prisma.refreshTokenFamily.upsert).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses refresh issuance for a confirmed factor under the owner lock', async () => {
    prisma.mfaAuthenticator.findUnique.mockResolvedValueOnce({ confirmed: true });
    await expect(store.saveRefreshToken(refresh)).rejects.toThrow('MFA authentication required');
    expect(prisma.refreshTokenFamily.upsert).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('creates a refresh family and token within one transaction', async () => {
    await store.saveRefreshToken(refresh);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    const [userSql, lockedUserId] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(userSql.join('?')).toContain('FROM "users"');
    expect(userSql.join('?')).toContain('FOR UPDATE');
    expect(lockedUserId).toBe(refresh.userId);
    expect(prisma.refreshTokenFamily.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { id: refresh.familyId },
      create: {
        id: refresh.familyId,
        userId: refresh.userId,
        familyExpiresAt: refresh.familyExpiresAt,
      },
      update: {},
      select: { id: true },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    const [sql, familyId] = prisma.$queryRaw.mock.calls[1] as unknown as [
      TemplateStringsArray,
      string,
    ];
    expect(sql.join('?')).toContain('WHERE "id" = ?');
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(familyId).toBe(refresh.familyId);
    expect(prisma.refreshToken.create).toHaveBeenCalledExactlyOnceWith({
      data: {
        id: refresh.id,
        familyId: refresh.familyId,
        userId: refresh.userId,
        createdAt: refresh.createdAt,
        expiresAt: refresh.expiresAt,
        familyExpiresAt: refresh.familyExpiresAt,
        usedAt: null,
        revoked: false,
        claims: refresh.claims,
      },
    });
  });

  it('persists a successor as revoked when its family was already revoked', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: refresh.userId }])
      .mockResolvedValueOnce([{ revokedAt: now }]);

    await store.saveRefreshToken(refresh);

    expect(prisma.refreshToken.create).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({
        id: refresh.id,
        familyId: refresh.familyId,
        revoked: true,
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('atomically marks a refresh token used only once and excludes deleted owners', async () => {
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(store.markRefreshTokenUsed(refresh.id, now)).resolves.toBe(true);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: refresh.id,
        usedAt: null,
        user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
      },
      data: { usedAt: now },
    });

    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(store.markRefreshTokenUsed(refresh.id, now)).resolves.toBe(false);
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 2 });
    await expect(store.markRefreshTokenUsed(refresh.id, now)).resolves.toBe(false);
  });

  it('revokes both the family tombstone and token rows in a single transaction', async () => {
    await store.revokeRefreshTokenFamily(refresh.familyId);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.refreshTokenFamily.updateMany).toHaveBeenCalledWith({
      where: { id: refresh.familyId },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: refresh.familyId },
      data: { revoked: true },
    });
  });

  it('recognizes a revoked family from either tombstone or token flags', async () => {
    await expect(store.isRefreshTokenFamilyRevoked(refresh.familyId)).resolves.toBe(false);

    prisma.refreshTokenFamily.findUnique.mockResolvedValueOnce({ revokedAt: now });
    await expect(store.isRefreshTokenFamilyRevoked(refresh.familyId)).resolves.toBe(true);

    prisma.refreshToken.findFirst.mockResolvedValueOnce({ id: refresh.id });
    await expect(store.isRefreshTokenFamilyRevoked(refresh.familyId)).resolves.toBe(true);

    expect(prisma.refreshTokenFamily.findUnique).toHaveBeenCalledWith({
      where: { id: refresh.familyId },
      select: { revokedAt: true },
    });
    expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
      where: { familyId: refresh.familyId, revoked: true },
      select: { id: true },
    });
  });

  it('scopes sign-out-everywhere revocation to one user in both tables', async () => {
    await store.revokeUserRefreshTokens(refresh.userId);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.refreshTokenFamily.updateMany).toHaveBeenCalledWith({
      where: { userId: refresh.userId },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: refresh.userId },
      data: { revoked: true },
    });
  });

  it('persists an email token and evicts expired tokens under the advisory lock', async () => {
    await store.saveEmailToken(email);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    const sql = prisma.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(sql.join('')).toContain('pg_advisory_xact_lock');
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: {
        id: email.id,
        purpose: email.purpose,
        userId: email.userId,
        email: email.email,
        fingerprint: email.fingerprint,
        createdAt: email.createdAt,
        expiresAt: email.expiresAt,
      },
    });
    expect(prisma.emailToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: email.createdAt } },
    });
    expect(prisma.emailToken.findMany).toHaveBeenCalledWith({
      select: { id: true, expiresAt: true },
      orderBy: [{ expiresAt: 'desc' }, { id: 'desc' }],
      skip: 10_000,
      take: 1,
    });
  });

  it('uses a deterministic boundary to evict older pending email tokens', async () => {
    const cutoff = { id: 'cutoff-id', expiresAt };
    prisma.emailToken.findMany.mockResolvedValueOnce([cutoff]);

    await store.saveEmailToken(email);

    expect(prisma.emailToken.deleteMany).toHaveBeenLastCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: cutoff.expiresAt } },
          { expiresAt: cutoff.expiresAt, id: { lte: cutoff.id } },
        ],
      },
    });
  });

  it('atomically consumes only the token matching both its id and purpose', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        ...email,
        fingerprint: null,
      },
    ]);

    await expect(store.consumeEmailToken(email.id, email.purpose)).resolves.toEqual({
      id: email.id,
      purpose: email.purpose,
      userId: email.userId,
      email: email.email,
      createdAt: email.createdAt,
      expiresAt: email.expiresAt,
    });

    const [sql, id, purpose] = prisma.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      string,
      string,
    ];
    expect(sql.join('?')).toContain('DELETE FROM "email_tokens"');
    expect(sql.join('?')).toContain('"id" = ? AND "purpose" = ?');
    expect(id).toBe(email.id);
    expect(purpose).toBe(email.purpose);
  });

  it('does not fabricate an email token when atomic deletion finds no match', async () => {
    await expect(store.consumeEmailToken(email.id, email.purpose)).resolves.toBeUndefined();
  });

  it('deletes only email tokens matching both user and purpose', async () => {
    await store.deleteUserEmailTokens(email.userId, email.purpose);

    expect(prisma.emailToken.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: email.userId, purpose: email.purpose },
    });
  });

  it('deletes expired families in one statement and relies on FK cascade for tokens', async () => {
    await store.deleteExpiredRefreshTokens(now);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refreshTokenFamily.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { familyExpiresAt: { lte: now } },
    });
  });

  it('removes a bounded batch of expired refresh families using FK cascade', async () => {
    prisma.$executeRaw.mockResolvedValueOnce(23);
    const deleted = await store.deleteExpiredRefreshTokenFamiliesBatch(now, 500);
    expect(deleted).toBe(23);
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    const [sql, cutoff, limit] = prisma.$executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      Date,
      number,
    ];
    expect(sql.join('?')).toContain('DELETE FROM "refresh_token_families"');
    expect(sql.join('?')).toContain('"family_expires_at" <= ?');
    expect(sql.join('?')).toContain('FOR UPDATE SKIP LOCKED');
    expect(cutoff).toBe(now);
    expect(limit).toBe(500);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes only one bounded batch of expired email tokens', async () => {
    prisma.$executeRaw.mockResolvedValueOnce(5);
    await expect(store.deleteExpiredEmailTokensBatch(now, 250)).resolves.toBe(5);
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    const [sql, cutoff, limit] = prisma.$executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      Date,
      number,
    ];
    expect(sql.join('?')).toContain('DELETE FROM "email_tokens"');
    expect(sql.join('?')).toContain('"expires_at" <= ?');
    expect(sql.join('?')).toContain('FOR UPDATE SKIP LOCKED');
    expect(cutoff).toBe(now);
    expect(limit).toBe(250);
  });

  it('deletes only email tokens expired by the supplied cutoff', async () => {
    await store.deleteExpiredEmailTokens(now);

    expect(prisma.emailToken.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { expiresAt: { lte: now } },
    });
  });

  describe('failure-safe refresh and email token persistence', () => {
    it('does not issue a refresh token when its family disappears after upsert', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: refresh.userId }]).mockResolvedValueOnce([]);

      await expect(store.saveRefreshToken(refresh)).rejects.toThrow(
        'Refresh token family missing after upsert',
      );
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.refreshTokenFamily.upsert).toHaveBeenCalledOnce();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('does not lock or insert a token if the refresh family upsert fails', async () => {
      const failure = new Error('Refresh family insert failed');
      prisma.refreshTokenFamily.upsert.mockRejectedValueOnce(failure);

      await expect(store.saveRefreshToken(refresh)).rejects.toBe(failure);
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('does not insert an unlocked refresh token when the family lock fails', async () => {
      const failure = new Error('Refresh family row lock failed');
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: refresh.userId }])
        .mockRejectedValueOnce(failure);

      await expect(store.saveRefreshToken(refresh)).rejects.toBe(failure);
      expect(prisma.refreshTokenFamily.upsert).toHaveBeenCalledOnce();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('propagates a refresh-token insert failure without reporting a saved token', async () => {
      const failure = new Error('Refresh token insert failed');
      prisma.refreshToken.create.mockRejectedValueOnce(failure);

      await expect(store.saveRefreshToken(refresh)).rejects.toBe(failure);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
    });

    it('does not mark a refresh token used when the conditional update fails', async () => {
      const failure = new Error('Refresh usage update failed');
      prisma.refreshToken.updateMany.mockRejectedValueOnce(failure);

      await expect(store.markRefreshTokenUsed(refresh.id, now)).rejects.toBe(failure);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: refresh.id,
          usedAt: null,
          user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
        },
        data: { usedAt: now },
      });
    });

    it('propagates revocation lookup outages rather than declaring a family valid', async () => {
      const failure = new Error('Revocation lookup unavailable');
      prisma.refreshTokenFamily.findUnique.mockRejectedValueOnce(failure);

      await expect(store.isRefreshTokenFamilyRevoked(refresh.familyId)).rejects.toBe(failure);
      expect(prisma.refreshToken.findFirst).toHaveBeenCalledOnce();
    });

    it('does not update token rows if the family-wide revoke fails first', async () => {
      const failure = new Error('Revocation tombstone update failed');
      prisma.refreshTokenFamily.updateMany.mockRejectedValueOnce(failure);

      await expect(store.revokeUserRefreshTokens(refresh.userId)).rejects.toBe(failure);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('never writes an email token if the advisory transaction lock fails', async () => {
      const failure = new Error('Email-token advisory lock failed');
      prisma.$queryRaw.mockRejectedValueOnce(failure);

      await expect(store.saveEmailToken(email)).rejects.toBe(failure);
      expect(prisma.emailToken.create).not.toHaveBeenCalled();
      expect(prisma.emailToken.deleteMany).not.toHaveBeenCalled();
      expect(prisma.emailToken.findMany).not.toHaveBeenCalled();
    });

    it('aborts email-token retention cleanup when the token insert fails', async () => {
      const failure = new Error('Email token insert failed');
      prisma.emailToken.create.mockRejectedValueOnce(failure);

      await expect(store.saveEmailToken(email)).rejects.toBe(failure);
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      expect(prisma.emailToken.deleteMany).not.toHaveBeenCalled();
      expect(prisma.emailToken.findMany).not.toHaveBeenCalled();
    });

    it('propagates email-token consumption errors rather than returning no match', async () => {
      const failure = new Error('Atomic email-token delete failed');
      prisma.$queryRaw.mockRejectedValueOnce(failure);

      await expect(store.consumeEmailToken(email.id, email.purpose)).rejects.toBe(failure);
      const [sql, tokenId, purpose] = prisma.$queryRaw.mock.calls[0] as unknown as [
        TemplateStringsArray,
        string,
        string,
      ];
      expect(sql.join('?')).toContain('"id" = ? AND "purpose" = ?');
      expect(tokenId).toBe(email.id);
      expect(purpose).toBe(email.purpose);
    });

    it('does not convert refresh-token read outages into an absent token', async () => {
      const failure = new Error('Refresh token lookup failed');
      prisma.refreshToken.findUnique.mockRejectedValueOnce(failure);

      await expect(store.getRefreshToken(refresh.id)).rejects.toBe(failure);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: refresh.id,
          user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
        },
        select: authRefreshTokenSelect,
      });
    });

    it('does not silently accept email-token expiration cleanup failures', async () => {
      const failure = new Error('Expired email token cleanup failed');
      prisma.emailToken.deleteMany.mockRejectedValueOnce(failure);

      await expect(store.deleteExpiredEmailTokens(now)).rejects.toBe(failure);
      expect(prisma.emailToken.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { expiresAt: { lte: now } },
      });
    });
  });
});
