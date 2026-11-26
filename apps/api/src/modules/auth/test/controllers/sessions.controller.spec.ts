import { describe, expect, it, vi } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { SessionRecord, SessionService, SignInService } from '@nestjs/authentication';
import { SessionsController } from '../../controllers/sessions.controller.js';
import type { AdminSessionFacade } from '../../public-api.js';

describe('SessionsController', () => {
  const makeController = () => {
    const sessionService = {
      list: vi.fn(),
      revoke: vi.fn(),
    };
    const signInService = {
      signOut: vi.fn(),
      signOutEverywhere: vi.fn(),
    };
    const adminSessions = { revokeAll: vi.fn(), signOut: vi.fn() };
    const request = { headers: {}, method: 'POST' } as never;
    const response = { append: vi.fn() } as never;
    const controller = new SessionsController(
      sessionService as unknown as SessionService,
      signInService as unknown as SignInService,
      adminSessions as unknown as AdminSessionFacade,
    );
    return {
      controller,
      sessionService,
      signInService,
      adminSessions,
      request,
      response,
    };
  };

  it('returns only minimal principal details after an admin-purpose guard', () => {
    const { controller } = makeController();
    expect(controller.adminSession('operator-id')).toEqual({ id: 'operator-id', role: 'ADMIN' });
  });

  it('delegates admin revocation to the scoped command for the current principal', async () => {
    const { controller, adminSessions, signInService, request, response, sessionService } =
      makeController();
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
    expect(signInService.signOut).not.toHaveBeenCalled();
    expect(sessionService.revoke).not.toHaveBeenCalled();
  });

  it('propagates scoped revocation errors without ordinary or duplicate sign-out', async () => {
    const { controller, adminSessions, signInService, request, response } = makeController();
    adminSessions.revokeAll.mockRejectedValueOnce(
      new Error('Admin revocation storage unavailable'),
    );
    await expect(controller.revokeAdminSessions('operator-id', request, response)).rejects.toThrow(
      'Admin revocation storage unavailable',
    );
    expect(signInService.signOut).not.toHaveBeenCalled();
    expect(adminSessions.signOut).not.toHaveBeenCalled();
  });

  it('admin-sign-out only delegates the scoped command and denies no-session callers', async () => {
    const { controller, adminSessions, request, response, signInService } = makeController();
    adminSessions.signOut.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(controller.adminSignOut(request, response)).resolves.toBeUndefined();
    await expect(controller.adminSignOut(request, response)).rejects.toThrow(UnauthorizedException);
    expect(adminSessions.signOut).toHaveBeenCalledTimes(2);
    expect(adminSessions.signOut).toHaveBeenCalledWith(request, response);
    expect(adminSessions.revokeAll).not.toHaveBeenCalled();
    expect(signInService.signOut).not.toHaveBeenCalled();
  });

  it('lists only safe session fields and marks the current session', async () => {
    const { controller, sessionService } = makeController();
    const current = {
      id: 'session-current',
      userId: 'user-1',
      createdAt: new Date('2026-10-30T10:00:00.000Z'),
      expiresAt: new Date('2026-11-06T10:00:00.000Z'),
      lastActiveAt: new Date('2026-10-30T10:30:00.000Z'),
      metadata: { userAgent: 'Test browser', ip: '192.0.2.1' },
    } as SessionRecord;
    const other = {
      ...current,
      id: 'session-other',
      metadata: null,
    } as unknown as SessionRecord;
    sessionService.list.mockResolvedValue([current, other]);

    await expect(controller.list('user-1', current)).resolves.toEqual([
      {
        id: 'session-current',
        createdAt: current.createdAt,
        lastActiveAt: current.lastActiveAt,
        userAgent: 'Test browser',
        current: true,
      },
      {
        id: 'session-other',
        createdAt: other.createdAt,
        lastActiveAt: other.lastActiveAt,
        userAgent: null,
        current: false,
      },
    ]);
    expect(sessionService.list).toHaveBeenCalledWith('user-1');
  });

  it('marks every session as non-current for JWT-only authentication', async () => {
    const { controller, sessionService } = makeController();
    const record = {
      id: 'session-one',
      userId: 'user-1',
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
      expiresAt: new Date('2026-11-17T10:00:00.000Z'),
      lastActiveAt: new Date('2026-11-10T10:10:00.000Z'),
      metadata: {
        userAgent: 'Browser A',
        ip: '192.0.2.2',
        authSecret: 'must-not-leak',
      },
    } as SessionRecord;
    sessionService.list.mockResolvedValue([record]);

    await expect(controller.list('user-1', undefined)).resolves.toEqual([
      {
        id: record.id,
        createdAt: record.createdAt,
        lastActiveAt: record.lastActiveAt,
        userAgent: 'Browser A',
        current: false,
      },
    ]);
    expect(sessionService.list).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('revokes a session scoped to the authenticated user', async () => {
    const { controller, sessionService } = makeController();
    sessionService.revoke.mockResolvedValue(true);

    await expect(controller.revoke('user-1', 'session-2')).resolves.toBeUndefined();
    expect(sessionService.revoke).toHaveBeenCalledWith('session-2', {
      userId: 'user-1',
    });
  });

  it('returns not found for a session that does not belong to the user', async () => {
    const { controller, sessionService } = makeController();
    sessionService.revoke.mockResolvedValue(false);

    await expect(controller.revoke('user-1', 'someone-elses-session')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('signs out the current browser session', async () => {
    const { controller, signInService } = makeController();
    signInService.signOut.mockResolvedValue(true);

    await expect(controller.signOut()).resolves.toBeUndefined();
    expect(signInService.signOut).toHaveBeenCalledOnce();
  });

  it('rejects sign-out when there is no session cookie', async () => {
    const { controller, signInService } = makeController();
    signInService.signOut.mockResolvedValue(false);

    await expect(controller.signOut()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('signs the user out everywhere', async () => {
    const { controller, signInService } = makeController();

    await expect(controller.signOutEverywhere('user-1')).resolves.toBeUndefined();
    expect(signInService.signOutEverywhere).toHaveBeenCalledWith('user-1');
  });
});
