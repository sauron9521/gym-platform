import type {
  AuthenticationStorage,
  EmailTokenRecord,
  RefreshTokenRecord,
} from '@nestjs/authentication';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '#src/infra/database/index';
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
    $transaction: vi.fn(),
  };
  const storage = { registerSource: vi.fn() };
  let store: PrismaTokenStore;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    prisma.refreshToken.findFirst.mockResolvedValue(null);
    prisma.refreshTokenFamily.findUnique.mockResolvedValue(null);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailToken.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
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
      where: { id: refresh.id, user: { deletedAt: null } },
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

  it('creates a refresh family and token within one transaction', async () => {
    await store.saveRefreshToken(refresh);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.refreshTokenFamily.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { id: refresh.familyId },
      create: {
        id: refresh.familyId,
        userId: refresh.userId,
        familyExpiresAt: refresh.familyExpiresAt,
      },
      update: {},
    });
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

  it('atomically marks a refresh token used only once and excludes deleted owners', async () => {
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(store.markRefreshTokenUsed(refresh.id, now)).resolves.toBe(true);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: refresh.id,
        usedAt: null,
        user: { deletedAt: null },
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

  it('cleans refresh tokens by family expiration and removes only empty families', async () => {
    await store.deleteExpiredRefreshTokens(now);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { familyExpiresAt: { lte: now } },
    });
    expect(prisma.refreshTokenFamily.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        familyExpiresAt: { lte: now },
        tokens: { none: {} },
      },
    });
  });

  it('deletes only email tokens expired by the supplied cutoff', async () => {
    await store.deleteExpiredEmailTokens(now);

    expect(prisma.emailToken.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { expiresAt: { lte: now } },
    });
  });
});
