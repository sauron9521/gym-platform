import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  EmailVerificationLink,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { Mailable, Mailer } from '@nestjs/mail';
import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';

type LocalizedVerificationLink = EmailVerificationLink & { locale?: 'uk' | 'en' };

@Injectable()
export class VerifyEmailMail implements Mailable<LocalizedVerificationLink> {
  render({ url, locale }: LocalizedVerificationLink) {
    // Only two known template filenames; malformed values cannot form a path.
    const language = locale === 'en' ? 'en' : 'uk';
    return {
      subject: language === 'en' ? 'Confirm your email address' : 'Підтвердіть електронну адресу',
      template: `verify-email.${language}`,
      context: { url },
    };
  }
}

@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly usersRepository: UsersAuthFacade,
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
