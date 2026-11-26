import type { EmailVerificationService } from '@nestjs/authentication';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailVerificationController } from '../../controllers/email-verification.controller.js';

describe('EmailVerificationController', () => {
  const verification = { send: vi.fn(), verify: vi.fn() };
  const user = { email: 'member@example.test' };
  const controller = new EmailVerificationController(
    verification as unknown as EmailVerificationService,
  );

  beforeEach(() => vi.resetAllMocks());

  it('verifies a valid link but returns only the public email and verification flag', async () => {
    verification.verify.mockResolvedValueOnce({
      email: user.email,
      token: 'secret-verification-token',
      passwordHash: 'must-not-leak',
    });

    await expect(controller.verifyEmail({ token: 'verification-token' })).resolves.toEqual({
      email: user.email,
      emailVerified: true,
    });
    expect(verification.verify).toHaveBeenCalledExactlyOnceWith('verification-token');
    expect(verification.send).not.toHaveBeenCalled();
  });

  it('rejects expired or already-consumed verification links without exposing the token', async () => {
    verification.verify.mockResolvedValueOnce(null);

    await expect(controller.verifyEmail({ token: 'expired-token' })).rejects.toMatchObject({
      status: 400,
      response: { message: 'Invalid or expired link' },
    });
    expect(verification.verify).toHaveBeenCalledExactlyOnceWith('expired-token');
    expect(verification.send).not.toHaveBeenCalled();
  });

  it('propagates verification persistence outages rather than claiming the email was verified', async () => {
    const failure = new Error('Verification token storage unavailable');
    verification.verify.mockRejectedValueOnce(failure);

    await expect(controller.verifyEmail({ token: 'verification-token' })).rejects.toBe(failure);
    expect(verification.send).not.toHaveBeenCalled();
  });
});
