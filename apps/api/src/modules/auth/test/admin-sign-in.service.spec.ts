import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSignInService, type CredentialsService } from '../public-api.js';
import type { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';
import type { Response } from 'express';

describe('AdminSignInService', () => {
  const credentialsService = { verify: vi.fn() };
  const adminCookieAuth = { signIn: vi.fn() };
  const adminRequest = { headers: {}, method: 'POST' };
  const adminResponse = { append: vi.fn() } as unknown as Response;
  const service = new AdminSignInService(
    credentialsService as unknown as CredentialsService,
    adminCookieAuth as unknown as AdminCookieAuthService,
  );
  beforeEach(() => vi.resetAllMocks());
  describe('adminSignIn', () => {
    const input = { email: 'admin@example.test', password: 'StrongPassword123!' };

    it('marks only an authenticated ADMIN session and preserves the MFA challenge', async () => {
      credentialsService.verify.mockResolvedValue({
        id: 'operator-id',
        email: input.email,
        role: 'ADMIN',
      });
      adminCookieAuth.signIn.mockResolvedValue({ session: { mfa: 'pending' } });
      await expect(service.signIn(input, adminRequest, adminResponse)).resolves.toEqual({
        mfaRequired: true,
      });
      expect(adminCookieAuth.signIn).toHaveBeenCalledExactlyOnceWith(
        'operator-id',
        adminRequest,
        adminResponse,
      );
    });

    it('refuses unknown credentials and non-admin roles identically without issuing a session', async () => {
      for (const principal of [
        null,
        { id: 'athlete', role: 'ATHLETE' },
        { id: 'trainer', role: 'TRAINER' },
      ]) {
        credentialsService.verify.mockResolvedValueOnce(principal);
        await expect(service.signIn(input, adminRequest, adminResponse)).rejects.toThrow(
          UnauthorizedException,
        );
      }
      expect(adminCookieAuth.signIn).not.toHaveBeenCalled();
    });
  });

  it('propagates cookie issuance failure and does not claim successful login', async () => {
    credentialsService.verify.mockResolvedValue({ id: 'operator-id', role: 'ADMIN' });
    const failure = new Error('Session storage unavailable');
    adminCookieAuth.signIn.mockRejectedValue(failure);
    await expect(
      service.signIn(
        { email: 'admin@example.test', password: 'StrongPassword123!' },
        adminRequest,
        adminResponse,
      ),
    ).rejects.toBe(failure);
  });
});
