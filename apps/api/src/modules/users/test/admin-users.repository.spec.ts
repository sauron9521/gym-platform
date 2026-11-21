import { describe, expect, it, vi } from 'vitest';

import { UsersRepository } from '../repositories/users.repository.js';
import { adminUserListSelect } from '../selects/user.select.js';
import type { PrismaService } from '#src/infra/database/index';

describe('UsersRepository.listForAdmin', () => {
  it('whitelists fields, excludes deleted rows, bounds result size and stabilizes page order', async () => {
    const prisma = {
      user: { findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    };
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'a',
        email: 'user@example.test',
        role: 'ATHLETE',
        createdAt: new Date('2026-11-21T10:00:00Z'),
      },
    ]);
    prisma.user.count.mockResolvedValue(51);

    const repo = new UsersRepository(prisma as unknown as PrismaService);
    const result = await repo.listForAdmin({
      page: 2,
      limit: 20,
      role: 'ATHLETE',
      status: 'ACTIVE',
      search: 'user',
      createdFrom: '2026-01-01T00:00:00Z',
      createdTo: '2026-11-30T00:00:00Z',
    });

    const where = {
      deletedAt: null,
      role: 'ATHLETE',
      email: { contains: 'user', mode: 'insensitive' },
      createdAt: {
        gte: new Date('2026-01-01T00:00:00Z'),
        lte: new Date('2026-11-30T00:00:00Z'),
      },
    };
    expect(prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({
      where,
      skip: 20,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: adminUserListSelect,
    });
    expect(prisma.user.count).toHaveBeenCalledExactlyOnceWith({ where });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      data: [{ email: 'user@example.test', status: 'ACTIVE' }],
      meta: { total: 51, skip: 20, take: 20, totalPages: 3 },
    });
    expect(Object.keys(result.data[0]!)).toEqual(['id', 'email', 'role', 'createdAt', 'status']);
    expect(adminUserListSelect).not.toHaveProperty('passwordHash');
    expect(adminUserListSelect).not.toHaveProperty('deletedAt');
    expect(adminUserListSelect).not.toHaveProperty('profile');
  });
});
