import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

import { AdminSessionFacade } from '../public-api.js';
import type { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';
import type { PrismaSessionStore } from '../stores/prisma-session.store.js';

function fixture() {
  const store = { revokeAdminSessionsForUser: vi.fn() };
  const cookies = { signOut: vi.fn() };
  const request = { headers: {}, method: 'POST' };
  const response = { append: vi.fn() } as unknown as Response;
  const facade = new AdminSessionFacade(
    store as unknown as PrismaSessionStore,
    cookies as unknown as AdminCookieAuthService,
  );
  return { facade, store, cookies, request, response };
}

describe('AdminSessionFacade', () => {
  it.each([0, 2])(
    'awaits scoped revocation (%i rows) before clearing the cookie, even if sign-out returns false',
    async (count) => {
      const { facade, store, cookies, request, response } = fixture();
      let finish!: (count: number) => void;
      store.revokeAdminSessionsForUser.mockReturnValue(
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
      );
      cookies.signOut.mockResolvedValue(false);
      const pending = facade.revokeAll('operator-id', request, response);
      expect(store.revokeAdminSessionsForUser).toHaveBeenCalledExactlyOnceWith('operator-id');
      expect(cookies.signOut).not.toHaveBeenCalled();
      finish(count);
      await expect(pending).resolves.toBeUndefined();
      expect(cookies.signOut).toHaveBeenCalledExactlyOnceWith(request, response);
    },
  );

  it('propagates a failed transaction without clearing the cookie', async () => {
    const { facade, store, cookies, request, response } = fixture();
    const error = new Error('Revocation failed');
    store.revokeAdminSessionsForUser.mockRejectedValue(error);
    await expect(facade.revokeAll('operator-id', request, response)).rejects.toBe(error);
    expect(cookies.signOut).not.toHaveBeenCalled();
  });

  it('propagates cookie-service failure after the revocation transaction', async () => {
    const { facade, store, cookies, request, response } = fixture();
    const error = new Error('Cookie service failed');
    store.revokeAdminSessionsForUser.mockResolvedValue(1);
    cookies.signOut.mockRejectedValue(error);
    await expect(facade.revokeAll('operator-id', request, response)).rejects.toBe(error);
    expect(store.revokeAdminSessionsForUser).toHaveBeenCalledExactlyOnceWith('operator-id');
    expect(cookies.signOut).toHaveBeenCalledExactlyOnceWith(request, response);
  });

  it.each([true, false])(
    'preserves scoped sign-out result %s without bulk revocation',
    async (result) => {
      const { facade, store, cookies, request, response } = fixture();
      cookies.signOut.mockResolvedValue(result);
      await expect(facade.signOut(request, response)).resolves.toBe(result);
      expect(cookies.signOut).toHaveBeenCalledExactlyOnceWith(request, response);
      expect(store.revokeAdminSessionsForUser).not.toHaveBeenCalled();
    },
  );

  it('propagates scoped sign-out errors unchanged', async () => {
    const { facade, store, cookies, request, response } = fixture();
    const error = new Error('Sign-out failed');
    cookies.signOut.mockRejectedValue(error);
    await expect(facade.signOut(request, response)).rejects.toBe(error);
    expect(store.revokeAdminSessionsForUser).not.toHaveBeenCalled();
  });
});
