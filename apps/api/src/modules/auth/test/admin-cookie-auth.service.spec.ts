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
  const config = {
    get: (key: string) => (key === 'ADMIN_APP_URL' ? 'https://admin.example.test' : undefined),
    getOrThrow: () => 'https://app.example.test',
  };
  const service = new AdminCookieAuthService(
    {} as AuthenticationStorage,
    mfa as unknown as MfaService,
    events as unknown as AuthenticationEvents,
    config as never,
  );
  const request = { headers: {}, method: 'POST' } as never;
  const response = { append: vi.fn() };
  return { service, mfa, events, request, response };
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

  it('rotates only a pending Admin session when its second factor verifies', async () => {
    const { service, mfa, request, response } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue('valid-admin-token');
    vi.spyOn(service.sessions, 'validate').mockResolvedValue(record);
    mfa.verifyTotp.mockResolvedValue(true);
    const rotate = vi.spyOn(service.sessions, 'rotate').mockResolvedValue({
      session: { ...record, id: 'rotated', mfa: 'verified' },
      token: 'rotated-token',
      cookie: '__Host-admin-sid=rotated-token; Secure; HttpOnly',
    });
    const issued = await service.completeMfa(request, response as never, { code: '123456' });
    expect(mfa.verifyTotp).toHaveBeenCalledExactlyOnceWith('admin-id', '123456');
    expect(rotate).toHaveBeenCalledExactlyOnceWith(record, { mfa: 'verified' });
    expect(response.append).toHaveBeenCalledExactlyOnceWith('Set-Cookie', issued!.cookie);

    rotate.mockClear();
    mfa.verifyTotp.mockResolvedValue(false);
    expect(await service.completeMfa(request, response as never, { code: '654321' })).toBeNull();
    expect(rotate).not.toHaveBeenCalled();
  });

  it('does not verify or rotate an ordinary-purpose cookie in the Admin realm', async () => {
    const { service, mfa, request, response } = setup();
    vi.spyOn(service.sessions, 'tokenFrom').mockReturnValue('valid-admin-token');
    vi.spyOn(service.sessions, 'validate').mockResolvedValue({ ...record, metadata: {} });
    const rotate = vi.spyOn(service.sessions, 'rotate');
    expect(await service.completeMfa(request, response as never, { code: '123456' })).toBeNull();
    expect(rotate).not.toHaveBeenCalled();
    expect(mfa.verifyTotp).not.toHaveBeenCalled();
  });

  it.each([
    { code: '123456', recoveryCode: 'ABCDE-FGHIJ' },
    {},
    { code: 'invalid' },
    { recoveryCode: 'invalid' },
  ])(
    'rejects missing, ambiguous or malformed proof before reading the cookie',
    async (challenge) => {
      const { service, mfa, request, response } = setup();
      const validate = vi.spyOn(service.sessions, 'validate');
      await expect(service.completeMfa(request, response as never, challenge)).resolves.toBeNull();
      expect(validate).not.toHaveBeenCalled();
      expect(mfa.verifyTotp).not.toHaveBeenCalled();
      expect(mfa.verifyRecoveryCode).not.toHaveBeenCalled();
      expect(response.append).not.toHaveBeenCalled();
    },
  );

  it('rejects foreign-origin and non-POST challenges before verifying a factor', async () => {
    const { service, mfa, response } = setup();
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
    expect(mfa.verifyTotp).not.toHaveBeenCalled();
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
