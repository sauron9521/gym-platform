import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { AdminUsersController } from '../../controllers/admin-users.controller.js';
import { AdminUsersReadGuard } from '../../controllers/admin-users-read.guard.js';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';

const operatorId = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const otherId = 'd09c7567-626e-45d8-99f1-829ce4204fbd';
const operator = { id: operatorId, role: 'ADMIN' as const };

function context(role: 'ATHLETE' | 'TRAINER' | 'ADMIN' | undefined, id: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role, id } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('AdminUsersController security contract', () => {
  it('uses a post-auth scoped permission gate on the dedicated endpoint', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminUsersController)).toBe('admin/users');
    expect(Reflect.getMetadata('authentication:route', AdminUsersController)).toMatchObject({
      public: false,
      providers: [AdminSessionCookieProvider],
    });
    const handler = Object.getOwnPropertyDescriptor(AdminUsersController.prototype, 'list')?.value;
    const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler);
    expect(guards).toContain(AdminUsersReadGuard);
  });

  it('does not grant list access without an explicit operator allowlist and persisted ADMIN', () => {
    const configured = new AdminUsersReadGuard({ get: () => operatorId } as never);
    const defaultDenied = new AdminUsersReadGuard({ get: () => undefined } as never);

    expect(() => defaultDenied.canActivate(context('ADMIN', operatorId))).toThrow(
      ForbiddenException,
    );
    expect(configured.canActivate(context('ADMIN', operatorId))).toBe(true);
    for (const [role, id] of [
      ['ADMIN', otherId],
      ['ATHLETE', operatorId],
      ['TRAINER', operatorId],
      [undefined, operatorId],
    ] as const) {
      expect(() => configured.canActivate(context(role, id))).toThrow(ForbiddenException);
    }
  });

  it('records only an authenticated operator audit event after a successful directory read', async () => {
    const result = { data: [], meta: { total: 0, skip: 0, take: 20, totalPages: 0 } };
    const users = { listForAdmin: vi.fn().mockResolvedValue(result) };
    const audit = { record: vi.fn() };
    const controller = new AdminUsersController(users as never, audit as never);
    const query = { page: 1, limit: 20 };
    const request = {} as never;

    await expect(controller.list(query, operator, request)).resolves.toEqual(result);
    expect(users.listForAdmin).toHaveBeenCalledWith(query, operator);
    expect(audit.record).toHaveBeenCalledExactlyOnceWith(
      { actorId: operatorId, permission: 'admin.accounts.read', outcome: 'allowed' },
      request,
    );
  });

  it('does not record success if persistence fails', async () => {
    const users = { listForAdmin: vi.fn().mockRejectedValue(new Error('DB unavailable')) };
    const audit = { record: vi.fn() };
    const controller = new AdminUsersController(users as never, audit as never);
    await expect(controller.list({ page: 1, limit: 20 }, operator, {} as never)).rejects.toThrow(
      'DB unavailable',
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('uses the same post-auth permission guard on detail and audits successful reads only', async () => {
    const handler = Object.getOwnPropertyDescriptor(
      AdminUsersController.prototype,
      'detail',
    )?.value;
    const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler);
    expect(guards).toContain(AdminUsersReadGuard);
    const account = { id: otherId, email: 'person@example.test', status: 'ACTIVE' };
    const users = { findForAdminDetails: vi.fn().mockResolvedValue(account) };
    const audit = { record: vi.fn() };
    const controller = new AdminUsersController(users as never, audit as never);
    const req = {} as never;
    await expect(controller.detail(otherId, operator, req)).resolves.toEqual(account);
    expect(users.findForAdminDetails).toHaveBeenCalledExactlyOnceWith(otherId, operator);
    expect(audit.record).toHaveBeenCalledExactlyOnceWith(
      { actorId: operatorId, permission: 'admin.accounts.read', outcome: 'allowed' },
      req,
    );
  });

  it('does not audit not-found or failed detail reads as allowed', async () => {
    const users = { findForAdminDetails: vi.fn().mockResolvedValue(null) };
    const audit = { record: vi.fn() };
    const controller = new AdminUsersController(users as never, audit as never);
    await expect(controller.detail(otherId, operator, {} as never)).rejects.toThrow(
      'User not found',
    );
    users.findForAdminDetails.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(controller.detail(otherId, operator, {} as never)).rejects.toThrow(
      'DB unavailable',
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
