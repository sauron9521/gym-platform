import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminUsersReadService } from '../services/admin-users-read.service.js';

const operatorId = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const otherId = 'd09c7567-626e-45d8-99f1-829ce4204fbd';
const actor = { id: operatorId, role: 'ADMIN' as const };
const query = { page: 1, limit: 20 };

function setup(allowlist: string | undefined = operatorId) {
  const repository = {
    listForAdmin: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    findForAdminDetails: vi.fn().mockResolvedValue(null),
  };
  const config = { get: () => allowlist };
  const service = new AdminUsersReadService(repository as never, config as never);
  return { service, repository };
}

describe('AdminUsersReadService', () => {
  it('delegates only the two bounded reads for an allowed operator', async () => {
    const { service, repository } = setup();

    await expect(service.listForAdmin(query, actor)).resolves.toEqual({ data: [], meta: {} });
    await expect(service.findForAdminDetails(otherId, actor)).resolves.toBeNull();
    expect(repository.listForAdmin).toHaveBeenCalledExactlyOnceWith(query);
    expect(repository.findForAdminDetails).toHaveBeenCalledExactlyOnceWith(otherId);
  });

  it('denies nonoperators before accessing persistence', () => {
    const { service, repository } = setup();

    for (const denied of [
      { id: otherId, role: 'ADMIN' },
      { id: operatorId, role: 'ATHLETE' },
      { id: operatorId, role: 'TRAINER' },
    ] as const) {
      expect(() => service.listForAdmin(query, denied)).toThrow(ForbiddenException);
      expect(() => service.findForAdminDetails(otherId, denied)).toThrow(ForbiddenException);
    }
    expect(repository.listForAdmin).not.toHaveBeenCalled();
    expect(repository.findForAdminDetails).not.toHaveBeenCalled();
  });

  it('fails closed with an empty allowlist and preserves repository errors', async () => {
    const denied = setup('');
    expect(() => denied.service.listForAdmin(query, actor)).toThrow(ForbiddenException);
    expect(denied.repository.listForAdmin).not.toHaveBeenCalled();

    const allowed = setup();
    allowed.repository.listForAdmin.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(allowed.service.listForAdmin(query, actor)).rejects.toThrow('DB unavailable');
  });
});
