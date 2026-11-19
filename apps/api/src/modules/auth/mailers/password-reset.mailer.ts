import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { type Mailable, Mailer } from '@nestjs/mail';
import { UsersRepository } from '#src/modules/users/repositories/users.repository';

type LocalizedResetLink = PasswordResetLink & { locale?: 'uk' | 'en' };

@Injectable()
export class PasswordResetMail implements Mailable<LocalizedResetLink> {
  render({ url, locale }: LocalizedResetLink) {
    const language = locale === 'en' ? 'en' : 'uk';
    return {
      subject: language === 'en' ? 'Reset your password' : 'Скидання пароля',
      template: `password-reset.${language}`,
      context: { url },
    };
  }
}

@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(email: string) {
    const found = await this.usersRepository.findCredentials(email);
    return (
      found && {
        id: found.id,
        email: found.email,
        passwordHash: found.passwordHash,
      }
    );
  }

  async send(link: PasswordResetLink) {
    const locale = await this.usersRepository.getPreferredMailLocale(link.email);
    await this.mailer.send(PasswordResetMail, { to: link.email, data: { ...link, locale } });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.usersRepository.updatePassHash(userId, passwordHash);
  }
}
