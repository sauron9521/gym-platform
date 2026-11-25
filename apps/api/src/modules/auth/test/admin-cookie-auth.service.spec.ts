import { createHash } from 'node:crypto';
import {
  AuthenticationEvents,
  AuthenticationStorage,
  MfaService,
  type SessionRecord,
} from '@nestjs/authentication';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';

const now = new Date('2026-11-22T12:00:00Z');
const record: SessionRecord = {
  id: 'admin-session-id',
  userId: 'admin-id',
  createdAt: now,
  expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
  lastActiveAt: now,
  mfa: 'pending',
  metadata: { purpose: 'admin' },
};

function setup() {
  const mfa = { isEnrolled: vi.fn(), verifyTotp: vi.fn(), verifyRecoveryCode: vi.fn() };
  const events = { emit: vi.fn() };
  const challengeService = { complete: vi.fn() };
  const mfaSessions = { read: vi.fn(), discard: vi.fn().mockResolvedValue(false) };
  const config = {
    get: (key: string) => (key === 'ADMIN_APP_URL' ? 'https://admin.example.test' : undefined),
    getOrThrow: () => 'https://app.example.test',
  };
  const service = new AdminCookieAuthService(
    {} as AuthenticationStorage,
    mfa as unknown as MfaService,
    events as unknown as AuthenticationEvents,
    config as never,
    challengeService as never,
    mfaSessions as never,
  );
  const request = { headers: {}, method: 'POST' } as never;
  const response = { append: vi.fn() };
  return { service, mfa, events, request, response, challengeService, mfaSessions };
}

describe('separate Admin cookie realm', () => {
  it('issues only __Host-admin-sid with strict 8h/15m session policy and separate origin', async () => {
    const { service, mfa, events, request, response } = setup();
    const normalToken = 'ordinary-session';
    vi.spyOn(service.sessions, 'isCrossOriginWrite').mockReturnValue(false);
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue(normalToken);
    vi.spyOn(service.sessions, 'validate').mockResolvedValue(null);
    mfa.isEnrolled.mockResolvedValue(true);
    const create = vi.spyOn(service.sessions, 'create').mockResolvedValue({
      session: record,
      token: 'raw-admin-token',
      cookie: '__Host-admin-sid=raw-admin-token; Max-Age=600; Secure; HttpOnly',
    });

    const issued = await service.signIn('admin-id', request, response as never);
    expect(create).toHaveBeenCalledExactlyOnceWith('admin-id', {
      mfa: 'pending',
      metadata: { purpose: 'admin' },
      replacing: undefined,
    });
    expect(issued.session.mfa).toBe('pending');
    expect(response.append).toHaveBeenCalledExactlyOnceWith('Set-Cookie', issued.cookie);
    expect(issued.cookie).not.toContain('__Host-sid=');
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sign-in', userId: 'admin-id' }),
    );
  });

  it('refuses cross-origin sign-in before touching or issuing a session', async () => {
    const { service, mfa, request, response } = setup();
    vi.spyOn(service.sessions, 'isCrossOriginWrite').mockReturnValue(true);
    const create = vi.spyOn(service.sessions, 'create');
    await expect(service.signIn('admin-id', request, response as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(create).not.toHaveBeenCalled();
    expect(mfa.isEnrolled).not.toHaveBeenCalled();
  });

  it('delegates exact Admin cookie proof and appends only a committed rotation', async () => {
    const { service, challengeService, request, response } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue('valid-admin-token');
    const rotated = {
      session: { ...record, id: 'rotated', mfa: 'verified' },
      token: 'rotated-token',
      cookie: '__Host-admin-sid=rotated-token; Secure; HttpOnly',
    };
    challengeService.complete.mockResolvedValueOnce(rotated).mockResolvedValueOnce(null);
    const proof = { code: '123456' };
    expect(await service.completeMfa(request, response as never, proof)).toBe(rotated);
    expect(challengeService.complete).toHaveBeenCalledWith('valid-admin-token', proof);
    expect(response.append).toHaveBeenCalledExactlyOnceWith('Set-Cookie', rotated.cookie);
    response.append.mockClear();
    expect(await service.completeMfa(request, response as never, proof)).toBeNull();
    expect(response.append).not.toHaveBeenCalled();
  });

  it('does not attempt a challenge without an Admin cookie', async () => {
    const { service, challengeService, request, response } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue(undefined);
    expect(await service.completeMfa(request, response as never, { code: '123456' })).toBeNull();
    expect(challengeService.complete).not.toHaveBeenCalled();
  });

  it('accepts only legacy password sessions or the dedicated MFA reader', async () => {
    const { service, mfaSessions, request } = setup();
    const token = 'admin-token';
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue(token);
    const validate = vi.spyOn(service.sessions, 'validate');
    const legacy = { ...record, mfa: undefined };
    validate.mockResolvedValueOnce(legacy);
    expect(await service.validateAdminSession(request)).toEqual(legacy);
    expect(mfaSessions.read).not.toHaveBeenCalled();
    validate.mockResolvedValueOnce({ ...record, mfa: 'verified' });
    mfaSessions.read.mockResolvedValueOnce(null);
    expect(await service.validateAdminSession(request)).toBeNull();
    validate.mockResolvedValueOnce(null);
    const verified = { ...record, mfa: 'verified' };
    mfaSessions.read.mockResolvedValueOnce(verified);
    expect(await service.validateAdminSession(request)).toEqual(verified);
    expect(mfaSessions.read).toHaveBeenCalledWith(
      createHash('sha256').update(token).digest('base64url'),
    );
  });

  it('discards a scoped MFA cookie without consulting ordinary sessions', async () => {
    const { service, mfaSessions, request, response } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue('admin-token');
    mfaSessions.discard.mockResolvedValueOnce(true);
    const validate = vi.spyOn(service.sessions, 'validate');
    expect(await service.signOut(request, response as never)).toBe(true);
    expect(validate).not.toHaveBeenCalled();
    expect(response.append).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: '123456', recoveryCode: 'ABCDE-FGHIJ' },
    {},
    { code: 'invalid' },
    { recoveryCode: 'invalid' },
  ])(
    'rejects missing, ambiguous or malformed proof before reading the cookie',
    async (challenge) => {
      const { service, challengeService, request, response } = setup();
      const validate = vi.spyOn(service.sessions, 'validate');
      await expect(service.completeMfa(request, response as never, challenge)).resolves.toBeNull();
      expect(validate).not.toHaveBeenCalled();
      expect(challengeService.complete).not.toHaveBeenCalled();
      expect(response.append).not.toHaveBeenCalled();
    },
  );

  it('rejects foreign-origin and non-POST challenges before verifying a factor', async () => {
    const { service, challengeService, response } = setup();
    const validate = vi.spyOn(service.sessions, 'validate');
    for (const request of [
      { method: 'POST', headers: { origin: 'https://app.example.test' } },
      { method: 'GET', headers: {} },
    ]) {
      await expect(
        service.completeMfa(request as never, response as never, { code: '123456' }),
      ).rejects.toThrow(ForbiddenException);
    }
    expect(validate).not.toHaveBeenCalled();
    expect(challengeService.complete).not.toHaveBeenCalled();
    expect(response.append).not.toHaveBeenCalled();
  });

  it('ends only the Admin cookie with hashed token revocation, retaining normal cookies', async () => {
    const { service, request, response, events } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue('raw-admin-token');
    vi.spyOn(service.sessions, 'validate').mockResolvedValue(record);
    const discard = vi.spyOn(service.sessions, 'discard').mockResolvedValue(undefined);
    await expect(service.signOut(request, response as never)).resolves.toBe(true);
    expect(discard).toHaveBeenCalledWith(
      createHash('sha256').update('raw-admin-token').digest('base64url'),
    );
    expect(response.append).toHaveBeenCalledExactlyOnceWith(
      'Set-Cookie',
      expect.stringContaining('__Host-admin-sid='),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sign-out', sessionId: record.id }),
    );
  });
});
