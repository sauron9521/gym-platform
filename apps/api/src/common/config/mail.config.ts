import {
  FileTemplateEngine,
  LogMailTransport,
  MailMessageError,
  SmtpTransport,
  type MailMessage,
  type MailTransportSendOptions,
} from '@nestjs/mail';
import type { AppEnv } from './env.schema.js';

type MailEnv = Pick<AppEnv, 'NODE_ENV' | 'SMTP_URL' | 'MAIL_FROM' | 'SMTP_RECIPIENT_ALLOWLIST'>;

/** Reject the entire message before SMTP, including every CC and BCC recipient. */
class RestrictedSmtpTransport extends SmtpTransport {
  private readonly allowed: ReadonlySet<string>;

  constructor(url: string, allowlist: string) {
    super({ url });
    this.allowed = new Set(allowlist.split(',').map((address) => address.trim()));
  }

  override async send(message: MailMessage, options: MailTransportSendOptions) {
    if (message.envelope.to.some((address) => !this.allowed.has(address))) {
      throw new MailMessageError('to', 'Recipient is outside the SMTP allowlist');
    }
    return super.send(message, options);
  }
}

/** Keep the template path in app.module.ts so dist/mail/templates is preserved. */
export function createMailOptions(env: MailEnv, templateDirectory: string) {
  if (env.NODE_ENV === 'production' && (!env.SMTP_URL || !env.MAIL_FROM)) {
    throw new Error('Production email requires SMTP_URL and MAIL_FROM');
  }
  if (
    env.NODE_ENV === 'production' &&
    env.SMTP_URL &&
    new URL(env.SMTP_URL).protocol !== 'smtps:'
  ) {
    throw new Error('Production email requires encrypted SMTPS transport');
  }

  if (env.SMTP_RECIPIENT_ALLOWLIST && !env.SMTP_URL) {
    throw new Error('SMTP recipient allowlist requires configured SMTP transport');
  }

  const transport = env.SMTP_URL
    ? env.SMTP_RECIPIENT_ALLOWLIST
      ? new RestrictedSmtpTransport(env.SMTP_URL, env.SMTP_RECIPIENT_ALLOWLIST)
      : new SmtpTransport({ url: env.SMTP_URL })
    : new LogMailTransport();

  return {
    transport,
    templates: new FileTemplateEngine({ dir: templateDirectory }),
    from: env.MAIL_FROM ?? 'Gym Dev <dev@example.test>',
  };
}
