import { describe, expect, it, vi } from 'vitest';

import { AdminMfaSessionReader } from '../stores/admin-mfa-session-reader.js';
import { ADMIN_MFA_METADATA, adminMfaSessionScope } from '../stores/admin-mfa-session-scope.js';

function setup() {
  const now = Date.now();
  const row = {
    id: 'session-id',
    userId: 'admin-id',
    mfa: 'verified',
    metadata: ADMIN_MFA_METADATA,
    createdAt: new Date(now - 120_000),
    expiresAt: new Date(now + 60_000),
    lastActiveAt: new Date(now - 120_000),
    user: { authInvalidatedAt: null },
  };
  const prisma = {
    session: {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = { get: vi.fn().mockReturnValue('configured') };
  const reader = new AdminMfaSessionReader(prisma as never, config as never);
  return { reader, prisma, config, row };
}

describe('AdminMfaSessionReader', () => {
  it('requires a configured keyring and a scoped persisted row', async () => {
    const { reader, prisma, config } = setup();
    config.get.mockReturnValueOnce(undefined);
    expect(await reader.read('session-id')).toBeNull();
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
    prisma.session.findFirst.mockResolvedValueOnce(null);
    expect(await reader.read('session-id')).toBeNull();
  });

  it('checks provenance, current role and enrolled factor in the database', async () => {
    const { reader, prisma, row } = setup();
    expect(await reader.read(row.id)).toMatchObject({ id: row.id, mfa: 'verified' });
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: {
        ...adminMfaSessionScope(row.id),
        user: {
          role: 'ADMIN',
          status: 'ACTIVE',
          deletedAt: null,
          mfaAuthenticator: { is: { confirmed: true } },
        },
      },
      select: expect.any(Object),
    });
    expect(prisma.session.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ...adminMfaSessionScope(row.id),
        mfa: 'verified',
        userId: row.userId,
        lastActiveAt: row.lastActiveAt,
      }),
      data: { lastActiveAt: expect.any(Date) },
    });
  });

  it('does not slide pending sessions or recently touched verified sessions', async () => {
    const { reader, prisma, row } = setup();
    row.mfa = 'pending';
    expect(await reader.read(row.id)).toMatchObject({ mfa: 'pending' });
    row.mfa = 'verified';
    row.lastActiveAt = new Date();
    expect(await reader.read(row.id)).toMatchObject({ mfa: 'verified' });
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it.each(['expired', 'idle', 'fence', 'pending'] as const)(
    'rejects %s without refreshing activity',
    async (kind) => {
      const { reader, prisma, row } = setup();
      if (kind === 'expired') row.expiresAt = new Date(0);
      if (kind === 'idle') row.lastActiveAt = new Date(Date.now() - 901_000);
      if (kind === 'fence') {
        prisma.session.findFirst.mockResolvedValueOnce({
          ...row,
          user: { authInvalidatedAt: row.createdAt },
        });
      }
      if (kind === 'pending') {
        row.mfa = 'pending';
        row.createdAt = new Date(Date.now() - 301_000);
      }
      expect(await reader.read(row.id)).toBeNull();
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    },
  );

  it('fails closed when activity update loses a concurrent revocation', async () => {
    const { reader, prisma, row } = setup();
    prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await reader.read(row.id)).toBeNull();
  });

  it('discards exactly one scoped MFA row, never a global session', async () => {
    const { reader, prisma, row } = setup();
    expect(await reader.discard(row.id)).toBe(true);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: adminMfaSessionScope(row.id),
    });
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await reader.discard(row.id)).toBe(false);
  });
});
