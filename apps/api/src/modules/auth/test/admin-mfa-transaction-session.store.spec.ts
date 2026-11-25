import type { SessionRecord } from '@nestjs/authentication';
import { describe, expect, it, vi } from 'vitest';

import type { Prisma } from '#prisma/client';
import { AdminMfaTransactionSessionStore } from '../stores/admin-mfa-transaction-session.store.js';

function setup(state: 'pending' | 'verified' = 'pending') {
  const now = new Date();
  const record: SessionRecord = {
    id: 'session',
    userId: 'owner',
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    mfa: state,
    metadata: { purpose: 'admin' },
  };
  const tx = {
    session: {
      findFirst: vi.fn().mockResolvedValue(record),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const store = new AdminMfaTransactionSessionStore(
    tx as unknown as Prisma.TransactionClient,
    record.userId,
    state,
  );
  return { store, tx, record };
}

describe('AdminMfaTransactionSessionStore', () => {
  it('caps pending lifetime without extending a shorter expiry', async () => {
    const { store, tx, record } = setup();
    await store.createSession(record);
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBe(300_000);
    const shorter = { ...record, expiresAt: new Date(record.createdAt.getTime() + 1000) };
    await store.createSession(shorter);
    expect(shorter.expiresAt.getTime() - shorter.createdAt.getTime()).toBe(1000);
    expect(tx.session.create).toHaveBeenCalledTimes(2);
  });

  it('never extends a verified expiry and rejects cross-owner and wrong-state writes', async () => {
    const { store, tx, record } = setup('verified');
    record.expiresAt = new Date(record.createdAt.getTime() + 1000);
    await store.createSession(record);
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBe(1000);
    await expect(store.createSession({ ...record, userId: 'other' })).rejects.toThrow(
      'Admin MFA session owner mismatch',
    );
    await expect(store.createSession({ ...record, mfa: 'pending' })).rejects.toThrow(
      'Admin MFA session state mismatch',
    );
    await expect(store.createSession({ ...record, metadata: {} })).rejects.toThrow(
      'Admin MFA session state mismatch',
    );
    expect(tx.session.create).toHaveBeenCalledTimes(1);
  });

  it('scopes reads, activity and deletion to the exact owner and Admin purpose', async () => {
    const { store, tx, record } = setup();
    const scope = {
      id: record.id,
      userId: record.userId,
      metadata: { path: ['purpose'], equals: 'admin' },
    };
    expect(await store.getSession(record.id)).toMatchObject({ id: record.id });
    expect(tx.session.findFirst).toHaveBeenCalledWith({
      where: { ...scope, mfa: { in: ['pending', 'verified'] } },
      select: expect.any(Object),
    });
    tx.session.findFirst.mockResolvedValueOnce(null);
    expect(await store.getSession(record.id)).toBeUndefined();
    tx.session.findFirst.mockResolvedValueOnce({ ...record, expiresAt: new Date(0) });
    expect(await store.getSession(record.id)).toBeUndefined();
    await store.touchSession(record.id, record.lastActiveAt);
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { ...scope, lastActiveAt: { lt: record.lastActiveAt } },
      data: { lastActiveAt: record.lastActiveAt },
    });
    expect(await store.deleteSession(record.id)).toBe(true);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: scope });
    tx.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await store.deleteSession(record.id)).toBe(false);
  });

  it('does not expose global session listing or bulk deletion', async () => {
    const { store, record } = setup();
    await expect(store.listUserSessions(record.userId)).rejects.toThrow('listing is unavailable');
    await expect(store.deleteUserSessions(record.userId)).rejects.toThrow(
      'bulk deletion is unavailable',
    );
  });
});
