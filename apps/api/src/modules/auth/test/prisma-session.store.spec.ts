import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticationStorage, MfaState } from '@nestjs/authentication';
import { PrismaSessionStore } from '../stores/index.js';
import { PrismaService } from '#src/infra/database/index';
import { authSessionSelect } from '../selects/auth-session.select.js';

describe('PrismaSessionStore', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  const storage = {
    registerSource: vi.fn(),
  };

  let store: PrismaSessionStore;

  const session = {
    id: 'a'.repeat(64),
    userId: 'user-123',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    expiresAt: new Date('2026-10-08T10:00:00.000Z'),
    lastActiveAt: new Date('2026-10-01T10:00:00.000Z'),
    mfa: 'verified' as MfaState,
    metadata: { ip: '127.0.0.1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    prisma.$queryRaw.mockResolvedValue([{ id: session.userId }]);
    prisma.session.findUnique.mockResolvedValue(null);
    prisma.session.create.mockResolvedValue(session);
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });
    prisma.session.findMany.mockResolvedValue([]);
    prisma.$executeRaw.mockResolvedValue(0);

    store = new PrismaSessionStore(
      prisma as unknown as PrismaService,
      storage as unknown as AuthenticationStorage,
    );
  });

  it('registers itself as the session store', () => {
    expect(storage.registerSource).toHaveBeenCalledWith({
      sessions: store,
    });
  });

  it('returns undefined when the session does not exist', async () => {
    prisma.session.findUnique.mockResolvedValue(null);

    await expect(store.getSession(session.id)).resolves.toBeUndefined();
    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { id: session.id, user: { deletedAt: null, status: 'ACTIVE' } },
      select: authSessionSelect,
    });
  });

  it('returns a session without null optional fields', async () => {
    prisma.session.findUnique.mockResolvedValue({
      ...session,
      mfa: null,
      metadata: null,
    });

    const result = await store.getSession(session.id);

    expect(result).toEqual({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActiveAt: session.lastActiveAt,
    });
    expect(result).not.toHaveProperty('mfa');
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('extra');
  });

  it('caps the admin session expiry in the same object used to issue the browser cookie', async () => {
    const admin = {
      ...session,
      expiresAt: new Date(session.expiresAt),
      metadata: { purpose: 'admin' },
    };
    await store.createSession(admin);
    const cap = new Date(session.createdAt.getTime() + 8 * 60 * 60 * 1000);
    expect(admin.expiresAt).toEqual(cap);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt: cap, metadata: { purpose: 'admin' } }),
    });
  });

  it('does not modify the expiry of a regular or short-lived pending-MFA session', async () => {
    const normal = { ...session };
    await store.createSession(normal);
    expect(normal.expiresAt).toEqual(session.expiresAt);

    const pending = {
      ...session,
      metadata: { purpose: 'admin' },
      expiresAt: new Date(session.createdAt.getTime() + 10 * 60 * 1000),
    };
    await store.createSession(pending);
    expect(pending.expiresAt).toEqual(new Date(session.createdAt.getTime() + 10 * 60 * 1000));
  });

  it('rejects an idle admin session at the storage boundary before session-service touch', async () => {
    const idleAdmin = {
      ...session,
      metadata: { purpose: 'admin' },
      lastActiveAt: new Date(Date.now() - 16 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    prisma.session.findUnique.mockResolvedValueOnce(idleAdmin);
    await expect(store.getSession(idleAdmin.id)).resolves.toBeUndefined();
    expect(prisma.session.updateMany).not.toHaveBeenCalled();

    prisma.session.findUnique.mockResolvedValueOnce({ ...idleAdmin, metadata: { device: 'app' } });
    expect(await store.getSession(idleAdmin.id)).toMatchObject({ id: idleAdmin.id });
  });

  it('rejects pre-policy admin session records past 8 hours, even if PostgreSQL expiry is 7 days', async () => {
    const legacyAdmin = {
      ...session,
      metadata: { purpose: 'admin' },
      createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
      lastActiveAt: new Date(Date.now()),
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    };
    prisma.session.findUnique.mockResolvedValueOnce(legacyAdmin);
    await expect(store.getSession(legacyAdmin.id)).resolves.toBeUndefined();
  });

  it('creates a session without persisting extra', async () => {
    await store.createSession({
      ...session,
      extra: { user: { id: session.userId } },
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    const [sql, id] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(sql.join('?')).toContain('"status" = \'ACTIVE\'');
    expect(id).toBe(session.userId);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: {
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActiveAt: session.lastActiveAt,
        mfa: 'verified',
        metadata: { ip: '127.0.0.1' },
      },
    });
  });

  it('never creates a session for a suspended or missing account', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(store.createSession(session)).rejects.toThrow('Account unavailable');
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('touches only when the new timestamp is later', async () => {
    const lastActiveAt = new Date('2026-10-01T11:00:00.000Z');

    await store.touchSession(session.id, lastActiveAt);

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: session.id,
        user: { deletedAt: null, status: 'ACTIVE' },
        lastActiveAt: { lt: lastActiveAt },
      },
      data: { lastActiveAt },
    });
  });

  it('returns true when a session is deleted', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });

    await expect(store.deleteSession(session.id)).resolves.toBe(true);
  });

  it('returns false when the session was already deleted', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });

    await expect(store.deleteSession(session.id)).resolves.toBe(false);
  });

  it('lists sessions for the requested user without filtering expired sessions', async () => {
    prisma.session.findMany.mockResolvedValue([session]);

    const result = await store.listUserSessions(session.userId);

    expect(prisma.session.findMany).toHaveBeenCalledWith({
      where: { userId: session.userId, user: { deletedAt: null, status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      select: authSessionSelect,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(session.id);
  });

  it('deletes only sessions expired at or before the cutoff', async () => {
    const now = new Date('2026-11-10T03:00:00.000Z');

    await store.deleteExpiredSessions(now);

    expect(prisma.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { expiresAt: { lte: now } },
    });
  });

  it('batches expired session deletions with an indexed ordered query', async () => {
    const now = new Date('2026-11-10T03:00:00.000Z');
    prisma.$executeRaw.mockResolvedValueOnce(17);

    await expect(store.deleteExpiredSessionsBatch(now, 500)).resolves.toBe(17);

    const [sql, cutoff, limit] = prisma.$executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      Date,
      number,
    ];
    expect(sql.join('?')).toContain('DELETE FROM "sessions"');
    expect(sql.join('?')).toContain('"expires_at" <= ?');
    expect(sql.join('?')).toContain('FOR UPDATE SKIP LOCKED');
    expect(cutoff).toBe(now);
    expect(limit).toBe(500);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('revokes only admin-purpose sessions with an account-row lock and preserves regular sessions', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 3 });
    await expect(store.revokeAdminSessionsForUser(session.userId)).resolves.toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    const [sql, id] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(id).toBe(session.userId);
    expect(prisma.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        userId: session.userId,
        metadata: { path: ['purpose'], equals: 'admin' },
      },
    });
  });

  it('fails closed if the revocation DB transaction fails', async () => {
    prisma.session.deleteMany.mockRejectedValueOnce(new Error('DB write failed'));
    await expect(store.revokeAdminSessionsForUser(session.userId)).rejects.toThrow(
      'DB write failed',
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('deletes all sessions for the requested user', async () => {
    await store.deleteUserSessions(session.userId);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: session.userId },
    });
  });

  describe('failure-safe session access and retention', () => {
    it('does not hide session read outages as an invalid session', async () => {
      const failure = new Error('Session database read failed');
      prisma.session.findUnique.mockRejectedValueOnce(failure);

      await expect(store.getSession(session.id)).rejects.toBe(failure);
      expect(prisma.session.findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: session.id, user: { deletedAt: null, status: 'ACTIVE' } },
        select: authSessionSelect,
      });
    });

    it('never lists a soft-deleted user’s sessions', async () => {
      prisma.session.findMany.mockResolvedValueOnce([]);

      await expect(store.listUserSessions('deleted-user')).resolves.toEqual([]);
      expect(prisma.session.findMany).toHaveBeenCalledExactlyOnceWith({
        where: { userId: 'deleted-user', user: { deletedAt: null, status: 'ACTIVE' } },
        orderBy: { createdAt: 'desc' },
        select: authSessionSelect,
      });
    });

    it('propagates a session-create failure rather than claiming a session exists', async () => {
      const failure = new Error('Session insert failed');
      prisma.session.create.mockRejectedValueOnce(failure);

      await expect(store.createSession(session)).rejects.toBe(failure);
      expect(prisma.session.create).toHaveBeenCalledOnce();
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('treats a missing or stale session touch as a no-op without creating a new row', async () => {
      prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
      const earlier = new Date('2026-09-30T10:00:00.000Z');

      await expect(store.touchSession(session.id, earlier)).resolves.toBeUndefined();
      expect(prisma.session.updateMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: session.id,
          user: { deletedAt: null, status: 'ACTIVE' },
          lastActiveAt: { lt: earlier },
        },
        data: { lastActiveAt: earlier },
      });
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('does not claim successful revocation if session deletion fails', async () => {
      const failure = new Error('Session delete failed');
      prisma.session.deleteMany.mockRejectedValueOnce(failure);

      await expect(store.deleteSession(session.id)).rejects.toBe(failure);
      expect(prisma.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { id: session.id },
      });
    });

    it('propagates batch-cleanup errors without treating active sessions as expired', async () => {
      const cutoff = new Date('2026-11-15T03:00:00.000Z');
      const failure = new Error('Session cleanup failed');
      prisma.$executeRaw.mockRejectedValueOnce(failure);

      await expect(store.deleteExpiredSessionsBatch(cutoff, 200)).rejects.toBe(failure);
      const [sql, date, batchSize] = prisma.$executeRaw.mock.calls[0] as unknown as [
        TemplateStringsArray,
        Date,
        number,
      ];
      expect(sql.join('?')).toContain('"expires_at" <= ?');
      expect(sql.join('?')).toContain('ORDER BY "expires_at", "id"');
      expect(sql.join('?')).toContain('LIMIT ?');
      expect(sql.join('?')).toContain('FOR UPDATE SKIP LOCKED');
      expect(date).toBe(cutoff);
      expect(batchSize).toBe(200);
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });
});
