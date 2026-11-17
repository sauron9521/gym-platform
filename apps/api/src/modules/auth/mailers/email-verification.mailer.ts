import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  EmailVerificationLink,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { Mailable, Mailer } from '@nestjs/mail';
import { UsersRepository } from '#src/modules/users/repositories/users.repository';

type LocalizedVerificationLink = EmailVerificationLink & { locale?: 'uk' | 'en' };

@Injectable()
export class VerifyEmailMail implements Mailable<LocalizedVerificationLink> {
  render({ url, locale = 'uk' }: LocalizedVerificationLink) {
    return {
      subject: locale === 'en' ? 'Confirm your email address' : 'Підтвердіть електронну адресу',
      template: `verify-email.${locale}`,
      context: { url },
    };
  }
}

@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('emailVerification', this);
  }

  async send(link: EmailVerificationLink) {
    const locale = await this.usersRepository.getPreferredMailLocale(link.email);
    await this.mailer.send(VerifyEmailMail, { to: link.email, data: { ...link, locale } });
  }

  markVerified(userId: string, email: string) {
    return this.usersRepository.markEmailVerified(userId, email);
  }
}
