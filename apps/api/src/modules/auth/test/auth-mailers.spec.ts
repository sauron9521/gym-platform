import type {
  AuthenticationRegistry,
  EmailVerificationLink,
  PasswordResetLink,
} from '@nestjs/authentication';
import type { Mailer } from '@nestjs/mail';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import { EmailVerificationMailer, VerifyEmailMail } from '../mailers/email-verification.mailer.js';
import { PasswordResetMail, PasswordResetMailer } from '../mailers/password-reset.mailer.js';

describe('Auth mail handlers', () => {
  const users = {
    findCredentials: vi.fn(),
    getPreferredMailLocale: vi.fn(),
    markEmailVerified: vi.fn(),
    updatePassHash: vi.fn(),
  };
  const mailer = { send: vi.fn() };
  const registry = { registerHandler: vi.fn() };
  let verification: EmailVerificationMailer;
  let recovery: PasswordResetMailer;

  beforeEach(() => {
    vi.resetAllMocks();
    users.getPreferredMailLocale.mockResolvedValue('uk');
    verification = new EmailVerificationMailer(
      users as unknown as UsersAuthFacade,
      mailer as unknown as Mailer,
      registry as unknown as AuthenticationRegistry,
    );
    recovery = new PasswordResetMailer(
      users as unknown as UsersAuthFacade,
      mailer as unknown as Mailer,
      registry as unknown as AuthenticationRegistry,
    );
  });

  it('registers the two distinct authentication handlers', () => {
    expect(registry.registerHandler).toHaveBeenNthCalledWith(1, 'emailVerification', verification);
    expect(registry.registerHandler).toHaveBeenNthCalledWith(2, 'passwordReset', recovery);
  });

  it('renders verification and recovery links in their intended templates', () => {
    const url = 'https://app.example.test/verify?token=opaque';

    expect(new VerifyEmailMail().render({ url } as EmailVerificationLink)).toEqual({
      subject: 'Підтвердіть електронну адресу',
      template: 'verify-email.uk',
      context: { url },
    });
    expect(new PasswordResetMail().render({ url } as PasswordResetLink)).toEqual({
      subject: 'Скидання пароля',
      template: 'password-reset.uk',
      context: { url },
    });
  });

  it('renders English mail and restricts unexpected language to the Ukrainian template', () => {
    const url = 'https://app.example.test/reset-password?token=opaque';
    expect(
      new VerifyEmailMail().render({ url, locale: 'en' } as EmailVerificationLink & {
        locale: 'en';
      }),
    ).toEqual({
      subject: 'Confirm your email address',
      template: 'verify-email.en',
      context: { url },
    });
    expect(
      new PasswordResetMail().render({ url, locale: 'en' } as PasswordResetLink & {
        locale: 'en';
      }),
    ).toEqual({
      subject: 'Reset your password',
      template: 'password-reset.en',
      context: { url },
    });
    expect(
      new PasswordResetMail().render({ url, locale: 'fr' } as unknown as PasswordResetLink),
    ).toMatchObject({
      template: 'password-reset.uk',
    });
  });

  it('uses persisted language instead of an untrusted language hint in links', async () => {
    users.getPreferredMailLocale.mockResolvedValueOnce('en');
    const link = {
      url: 'https://app.example.test/reset?token=opaque&locale=uk',
      email: 'member@example.test',
      locale: 'uk',
    } as unknown as PasswordResetLink;
    await recovery.send(link);
    expect(users.getPreferredMailLocale).toHaveBeenCalledExactlyOnceWith(link.email);
    expect(mailer.send).toHaveBeenCalledExactlyOnceWith(PasswordResetMail, {
      to: link.email,
      data: { ...link, locale: 'en' },
    });
  });

  it('propagates a failed preference lookup instead of sending the wrong message', async () => {
    const failure = new Error('Database unavailable');
    users.getPreferredMailLocale.mockRejectedValueOnce(failure);
    await expect(
      verification.send({
        url: 'https://app.example.test/verify-email?token=opaque',
        email: 'member@example.test',
      } as EmailVerificationLink),
    ).rejects.toBe(failure);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('sends verification email only to the link owner with the matching template', async () => {
    const link = {
      url: 'https://app.example.test/verify?token=opaque',
      email: 'member@example.test',
    } as EmailVerificationLink;

    mailer.send.mockResolvedValue(undefined);
    await expect(verification.send(link)).resolves.toBeUndefined();

    expect(mailer.send).toHaveBeenCalledExactlyOnceWith(VerifyEmailMail, {
      to: link.email,
      data: { ...link, locale: 'uk' },
    });
    expect(users.markEmailVerified).not.toHaveBeenCalled();
  });

  it('propagates verification transport failures without marking an address as verified', async () => {
    const failure = new Error('SMTP transport unavailable');
    mailer.send.mockRejectedValueOnce(failure);

    await expect(
      verification.send({
        url: 'https://app.example.test/verify?token=opaque',
        email: 'member@example.test',
      } as EmailVerificationLink),
    ).rejects.toBe(failure);

    expect(users.markEmailVerified).not.toHaveBeenCalled();
  });

  it('delegates verification updates using both user id and email', async () => {
    users.markEmailVerified.mockResolvedValueOnce({ count: 1 });

    await expect(verification.markVerified('user-1', 'member@example.test')).resolves.toEqual({
      count: 1,
    });
    expect(users.markEmailVerified).toHaveBeenCalledExactlyOnceWith(
      'user-1',
      'member@example.test',
    );
  });

  it('returns only credential fields needed by password recovery', async () => {
    users.findCredentials.mockResolvedValueOnce({
      id: 'user-1',
      email: 'member@example.test',
      passwordHash: 'stored-hash',
      role: 'ADMIN',
      profile: { displayName: 'Private profile' },
    });

    await expect(recovery.findUser('member@example.test')).resolves.toEqual({
      id: 'user-1',
      email: 'member@example.test',
      passwordHash: 'stored-hash',
    });
    expect(users.findCredentials).toHaveBeenCalledExactlyOnceWith('member@example.test');
  });

  it('does not fabricate a recoverable identity for an unknown address', async () => {
    users.findCredentials.mockResolvedValueOnce(null);

    await expect(recovery.findUser('missing@example.test')).resolves.toBeNull();
    expect(users.updatePassHash).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('does not suppress credential repository outages during recovery lookup', async () => {
    const failure = new Error('Database connection unavailable');
    users.findCredentials.mockRejectedValueOnce(failure);

    await expect(recovery.findUser('member@example.test')).rejects.toBe(failure);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('propagates password-reset transport failures without updating credentials', async () => {
    const failure = new Error('Mail transport unavailable');
    mailer.send.mockRejectedValueOnce(failure);
    const link = {
      url: 'https://app.example.test/reset?token=opaque',
      email: 'member@example.test',
    } as PasswordResetLink;

    await expect(recovery.send(link)).rejects.toBe(failure);
    expect(mailer.send).toHaveBeenCalledExactlyOnceWith(PasswordResetMail, {
      to: link.email,
      data: { ...link, locale: 'uk' },
    });
    expect(users.updatePassHash).not.toHaveBeenCalled();
  });

  it('delegates password updates and preserves persistence failures', async () => {
    const failure = new Error('Password store unavailable');
    users.updatePassHash.mockRejectedValueOnce(failure);

    await expect(recovery.updatePassword('user-1', 'new-hash')).rejects.toBe(failure);
    expect(users.updatePassHash).toHaveBeenCalledExactlyOnceWith('user-1', 'new-hash');
  });
});
