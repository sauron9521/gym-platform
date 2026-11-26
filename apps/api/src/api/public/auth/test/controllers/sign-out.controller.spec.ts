import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { SignInService } from '@nestjs/authentication';
import { SignOutController } from '../../controllers/sign-out.controller.js';

describe('SignOutController', () => {
  const makeController = () => {
    const signInService = { signOut: vi.fn() };
    return {
      controller: new SignOutController(signInService as unknown as SignInService),
      signInService,
    };
  };

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
});
