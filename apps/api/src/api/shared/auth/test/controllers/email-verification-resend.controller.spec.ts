import type { EmailVerificationService } from '@nestjs/authentication';
import { ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerificationResendActor } from '#src/modules/auth/public-api';
import { EmailVerificationResendController } from '../../controllers/email-verification-resend.controller.js';

describe('EmailVerificationResendController', () => {
  const verification = { send: vi.fn(), verify: vi.fn() };
  const controller = new EmailVerificationResendController(
    verification as unknown as EmailVerificationService,
  );
  const user: VerificationResendActor = {
    id: 'user-1',
    email: 'member@example.test',
    emailVerified: false,
  };

  beforeEach(() => vi.resetAllMocks());

  it('keeps the 202 accepted response on successful submission', async () => {
    verification.send.mockResolvedValue(undefined);

    await expect(controller.resend(user)).resolves.toBeUndefined();
    expect(verification.send).toHaveBeenCalledWith(user);
  });

  it('returns an actionable 503 without leaking the mail provider error', async () => {
    const log = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    verification.send.mockRejectedValue(new Error('SMTP auth secret leaked'));

    try {
      await expect(controller.resend(user)).rejects.toThrow(ServiceUnavailableException);
      expect(log).toHaveBeenCalledWith('AUTH_VERIFICATION_EMAIL_RESEND_FAILED');
      expect(JSON.stringify(log.mock.calls)).not.toContain('SMTP auth secret');
      expect(JSON.stringify(log.mock.calls)).not.toContain(user.email);
    } finally {
      log.mockRestore();
    }
  });

  it('refuses to resend verification for an already verified account', async () => {
    await expect(controller.resend({ ...user, emailVerified: true })).rejects.toThrow(
      ConflictException,
    );
    expect(verification.send).not.toHaveBeenCalled();
  });
});
