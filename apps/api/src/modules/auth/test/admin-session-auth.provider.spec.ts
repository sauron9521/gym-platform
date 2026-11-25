import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticationRegistry } from '@nestjs/authentication';
import { describe, expect, it, vi } from 'vitest';

import type { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import type { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';
import { AdminSessionAuth } from '../providers/admin-session-auth.provider.js';

function setup() {
  const users = { findUserById: vi.fn() };
  const sessions = { tokenFrom: vi.fn(), validate: vi.fn(), discard: vi.fn() };
  const cookies = { sessions, validateAdminSession: sessions.validate };
  const reflector = { getAllAndOverride: vi.fn() };
  const registry = { registerProvider: vi.fn() };
  const provider = new AdminSessionAuth(
    users as unknown as UsersAuthFacade,
    cookies as unknown as AdminCookieAuthService,
    reflector as unknown as Reflector,
    registry as unknown as AuthenticationRegistry,
  );
  const context = {
    getType: () => 'http',
    getClass: () => class Example {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, method: 'GET' }) }),
  } as unknown as ExecutionContext;
  return { provider, users, sessions, reflector, registry, context };
}

describe('AdminSessionAuth', () => {
  it('registers after standard cookie and JWT providers and refuses ordinary routes completely', async () => {
    const { provider, sessions, reflector, registry, context } = setup();
    expect(registry.registerProvider).toHaveBeenCalledExactlyOnceWith(provider, { order: 2 });
    reflector.getAllAndOverride.mockReturnValue(false);
    await expect(provider.authenticate(context)).resolves.toBeNull();
    expect(sessions.validate).not.toHaveBeenCalled();
    expect(sessions.tokenFrom).not.toHaveBeenCalled();
  });

  it('validates only admin-purpose records on marked Admin routes', async () => {
    const { provider, sessions, reflector, users, context } = setup();
    reflector.getAllAndOverride.mockReturnValue(true);
    const session = { id: 'id', userId: 'user', mfa: undefined, metadata: { purpose: 'admin' } };
    sessions.validate.mockResolvedValue(session);
    const principal = { id: 'user', role: 'ADMIN' };
    users.findUserById.mockResolvedValue(principal);
    await expect(provider.authenticate(context)).resolves.toMatchObject({
      user: principal,
      session,
    });
    expect(users.findUserById).toHaveBeenCalledExactlyOnceWith('user');

    sessions.validate.mockResolvedValue({ ...session, metadata: {} });
    users.findUserById.mockClear();
    await expect(provider.authenticate(context)).resolves.toBeNull();
    expect(users.findUserById).not.toHaveBeenCalled();
  });

  it.each(['invalid', '', null, true, 'pending'])(
    'rejects malformed persisted MFA state (%s)',
    async (mfa) => {
      const { provider, sessions, reflector, users, context } = setup();
      reflector.getAllAndOverride.mockReturnValue(true);
      sessions.validate.mockResolvedValue({ userId: 'user', metadata: { purpose: 'admin' }, mfa });
      await expect(provider.authenticate(context)).resolves.toBeNull();
      expect(users.findUserById).not.toHaveBeenCalled();
    },
  );
});
