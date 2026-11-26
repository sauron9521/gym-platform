import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { AdminSessionFacade } from '#src/modules/auth/public-api';
import { AdminSessionsController } from '../../controllers/admin-sessions.controller.js';

describe('AdminSessionsController', () => {
  const makeController = () => {
    const adminSessions = { revokeAll: vi.fn(), signOut: vi.fn() };
    const request = { headers: {}, method: 'POST' } as never;
    const response = { append: vi.fn() } as never;
    const controller = new AdminSessionsController(adminSessions as unknown as AdminSessionFacade);
    return { controller, adminSessions, request, response };
  };

  it('returns only minimal principal details after an admin-purpose guard', () => {
    const { controller } = makeController();
    expect(controller.adminSession('operator-id')).toEqual({ id: 'operator-id', role: 'ADMIN' });
  });

  it('delegates admin revocation to the scoped command for the current principal', async () => {
    const { controller, adminSessions, request, response } = makeController();
    adminSessions.revokeAll.mockResolvedValue(undefined);
    await expect(
      controller.revokeAdminSessions('operator-id', request, response),
    ).resolves.toBeUndefined();
    expect(adminSessions.revokeAll).toHaveBeenCalledExactlyOnceWith(
      'operator-id',
      request,
      response,
    );
    expect(adminSessions.signOut).not.toHaveBeenCalled();
  });

  it('propagates scoped revocation errors without ordinary or duplicate sign-out', async () => {
    const { controller, adminSessions, request, response } = makeController();
    adminSessions.revokeAll.mockRejectedValueOnce(
      new Error('Admin revocation storage unavailable'),
    );
    await expect(controller.revokeAdminSessions('operator-id', request, response)).rejects.toThrow(
      'Admin revocation storage unavailable',
    );
    expect(adminSessions.signOut).not.toHaveBeenCalled();
  });

  it('admin-sign-out only delegates the scoped command and denies no-session callers', async () => {
    const { controller, adminSessions, request, response } = makeController();
    adminSessions.signOut.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(controller.adminSignOut(request, response)).resolves.toBeUndefined();
    await expect(controller.adminSignOut(request, response)).rejects.toThrow(UnauthorizedException);
    expect(adminSessions.signOut).toHaveBeenCalledTimes(2);
    expect(adminSessions.signOut).toHaveBeenCalledWith(request, response);
    expect(adminSessions.revokeAll).not.toHaveBeenCalled();
  });
});
