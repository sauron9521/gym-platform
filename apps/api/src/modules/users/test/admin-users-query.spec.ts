import { describe, expect, it } from 'vitest';

import { adminUsersQuerySchema } from '../dto/admin-users-query.dto.js';

describe('Privileged users list query', () => {
  it('defaults to a safe bounded page', () => {
    expect(adminUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(adminUsersQuerySchema.parse({ page: '2', limit: '50', role: 'TRAINER' })).toMatchObject({
      page: 2,
      limit: 50,
      role: 'TRAINER',
    });
  });

  it('rejects unknown fields, invalid ranges, wildcards and suspension until modelled', () => {
    for (const input of [
      { limit: '51' },
      { limit: '0' },
      { page: '-1' },
      { page: '10001' },
      { search: 'x' },
      { search: 'a'.repeat(101) },
      { role: 'SUPERADMIN' },
      { status: 'SUSPENDED' },
      { deletedAt: 'any' },
      { createdFrom: 'bad' },
      { createdFrom: '2026-11-30T00:00:00Z', createdTo: '2026-11-01T00:00:00Z' },
    ]) {
      expect(adminUsersQuerySchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    }
  });

  it('accepts explicit bounded creation-date filters and ACTIVE status', () => {
    expect(
      adminUsersQuerySchema.parse({
        status: 'ACTIVE',
        createdFrom: '2026-01-01T00:00:00Z',
        createdTo: '2026-02-01T00:00:00Z',
      }),
    ).toMatchObject({ status: 'ACTIVE', page: 1, limit: 20 });
  });
});
