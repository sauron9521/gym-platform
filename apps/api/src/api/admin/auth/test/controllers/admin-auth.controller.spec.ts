import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AdminSignInService } from '#src/modules/auth/public-api';
import { AdminAuthController } from '../../controllers/admin-auth.controller.js';

describe('AdminAuthController', () => {
  const signIn = vi.fn();
  const controller = new AdminAuthController({ signIn } as unknown as AdminSignInService);
  const body = { email: 'admin@example.test', password: 'StrongPassword123!' };
  const request = { headers: {}, method: 'POST' } as Request;
  const response = { append: vi.fn() } as unknown as Response;

  beforeEach(() => vi.resetAllMocks());

  it.each([true, false])(
    'preserves the delegated MFA response %s and exact request/response',
    async (mfaRequired) => {
      signIn.mockResolvedValue({ mfaRequired });
      await expect(controller.adminSignIn(body, request, response)).resolves.toEqual({
        mfaRequired,
      });
      expect(signIn).toHaveBeenCalledExactlyOnceWith(body, request, response);
    },
  );

  it('propagates service rejection', async () => {
    const error = new Error('Sign-in failed');
    signIn.mockRejectedValue(error);
    await expect(controller.adminSignIn(body, request, response)).rejects.toBe(error);
  });
});
