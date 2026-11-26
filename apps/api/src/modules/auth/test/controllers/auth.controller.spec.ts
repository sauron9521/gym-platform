import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationService, SignInService } from '@nestjs/authentication';
import { ConfigService } from '@nestjs/config';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../controllers/auth.controller.js';
import { AdminCookieAuthService } from '../../services/admin-cookie-auth.service.js';
import { AdminSignInService } from '../../public-api.js';
import { CredentialsService } from '../../services/index.js';

describe('AuthController', () => {
  let controller: AuthController;

  const credentialsService = {
    register: vi.fn(),
    verify: vi.fn(),
  };

  const signInService = { signIn: vi.fn() };
  const adminCookieAuth = { signIn: vi.fn() };
  const adminRequest = { headers: {}, method: 'POST' } as never;
  const adminResponse = { append: vi.fn() } as never;

  const emailVerificationService = {
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AdminSignInService,
        { provide: AdminCookieAuthService, useValue: adminCookieAuth },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'APP_URL' ? 'http://localhost:3000' : undefined),
          },
        },
        {
          provide: CredentialsService,
          useValue: credentialsService,
        },
        {
          provide: SignInService,
          useValue: signInService,
        },
        {
          provide: EmailVerificationService,
          useValue: emailVerificationService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('signUp', () => {
    it('should register a user, create a session and send verification email', async () => {
      const input = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
      };

      const user = {
        id: 'user-1',
        email: input.email,
      };

      credentialsService.register.mockResolvedValue(user);
      signInService.signIn.mockResolvedValue({});
      emailVerificationService.send.mockResolvedValue(undefined);

      const result = await controller.signUp(input);

      expect(credentialsService.register).toHaveBeenCalledWith(input);
      expect(signInService.signIn).toHaveBeenCalledWith('user-1', {
        method: 'password',
      });
      expect(emailVerificationService.send).toHaveBeenCalledWith(user);
      expect(result).toEqual({ ...user, verificationEmailStatus: 'SUBMITTED' });
    });
    it('keeps the created account and session when email submission fails', async () => {
      const input = {
        email: 'new-user@example.test',
        password: 'StrongPassword123!',
      };
      const user = { id: 'user-1', email: input.email, emailVerified: false };
      const error = new Error('SMTP password and private address must stay hidden');
      const log = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      credentialsService.register.mockResolvedValue(user);
      signInService.signIn.mockResolvedValue({});
      emailVerificationService.send.mockRejectedValue(error);

      try {
        await expect(controller.signUp(input)).resolves.toEqual({
          ...user,
          verificationEmailStatus: 'RETRY_REQUIRED',
        });
        expect(credentialsService.register).toHaveBeenCalledOnce();
        expect(signInService.signIn).toHaveBeenCalledWith(user.id, {
          method: 'password',
        });
        expect(emailVerificationService.send).toHaveBeenCalledWith(user);
        expect(log).toHaveBeenCalledWith('AUTH_REGISTRATION_VERIFICATION_EMAIL_SUBMISSION_FAILED');
        expect(JSON.stringify(log.mock.calls)).not.toContain('SMTP password');
        expect(JSON.stringify(log.mock.calls)).not.toContain(input.email);
      } finally {
        log.mockRestore();
      }
    });

    it('does not hide sign-in failure or claim registration success', async () => {
      const input = {
        email: 'new-user@example.test',
        password: 'StrongPassword123!',
      };
      credentialsService.register.mockResolvedValue({ id: 'user-1', email: input.email });
      signInService.signIn.mockRejectedValue(new Error('Session storage failed'));

      await expect(controller.signUp(input)).rejects.toThrow('Session storage failed');
      expect(emailVerificationService.send).not.toHaveBeenCalled();
    });
  });

  describe('adminSignIn', () => {
    const input = { email: 'admin@example.test', password: 'StrongPassword123!' };

    it('marks only an authenticated ADMIN session and preserves the MFA challenge', async () => {
      credentialsService.verify.mockResolvedValue({
        id: 'operator-id',
        email: input.email,
        role: 'ADMIN',
      });
      adminCookieAuth.signIn.mockResolvedValue({ session: { mfa: 'pending' } });
      await expect(controller.adminSignIn(input, adminRequest, adminResponse)).resolves.toEqual({
        mfaRequired: true,
      });
      expect(adminCookieAuth.signIn).toHaveBeenCalledExactlyOnceWith(
        'operator-id',
        adminRequest,
        adminResponse,
      );
      expect(signInService.signIn).not.toHaveBeenCalled();
    });

    it('refuses unknown credentials and non-admin roles identically without issuing a session', async () => {
      for (const principal of [
        null,
        { id: 'athlete', role: 'ATHLETE' },
        { id: 'trainer', role: 'TRAINER' },
      ]) {
        credentialsService.verify.mockResolvedValueOnce(principal);
        await expect(controller.adminSignIn(input, adminRequest, adminResponse)).rejects.toThrow(
          UnauthorizedException,
        );
      }
      expect(adminCookieAuth.signIn).not.toHaveBeenCalled();
      expect(signInService.signIn).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('should return mfaRequired when credentials are valid', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
      };

      credentialsService.verify.mockResolvedValue(user);
      signInService.signIn.mockResolvedValue({
        session: { mfa: 'pending' },
      });

      const result = await controller.signIn({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      expect(credentialsService.verify).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPassword123!',
      );
      expect(signInService.signIn).toHaveBeenCalledWith('user-1', {
        method: 'password',
      });
      expect(result).toEqual({ mfaRequired: true });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      credentialsService.verify.mockResolvedValue(null);

      await expect(
        controller.signIn({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(signInService.signIn).not.toHaveBeenCalled();
    });
  });
});
