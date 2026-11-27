import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Mailer,
  MailMessageError,
  MailTemplateError,
  MailSmtpError,
  MailTimeoutError,
  MailConnectionError,
} from '@nestjs/mail';
import type { AppConfigService } from '#src/common/config/app-config.types';
import type { DeliveryOutcome, EmailDestination } from '../domain/notification-delivery.policy.js';

export function classifyEmailFailure(error: unknown): DeliveryOutcome {
  if (error instanceof MailMessageError || error instanceof MailTemplateError)
    return 'not_sent_permanent';
  // A negative SMTP reply for a pre-acceptance command or DATA is definite.
  // Do not use a generic "transient" flag for disconnected/timeout outcomes.
  if (
    error instanceof MailSmtpError &&
    ['greeting', 'HELO', 'EHLO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO', 'DATA'].includes(
      error.command,
    )
  ) {
    if (error.code >= 400 && error.code < 500) return 'not_sent_retryable';
    if (error.code >= 500 && error.code < 600) return 'not_sent_permanent';
  }
  if (error instanceof MailTimeoutError && ['connect', 'greeting', 'tls'].includes(error.phase))
    return 'not_sent_retryable';
  // A refusal or DNS failure establishes that a connection was never opened.
  if (
    error instanceof MailConnectionError &&
    error.cause instanceof Error &&
    'code' in error.cause &&
    ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(String(error.cause.code))
  )
    return 'not_sent_retryable';
  return 'unknown';
}

@Injectable()
export class NotificationEmailSender {
  constructor(
    private readonly mailer: Mailer,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async send(
    deliveryId: string,
    destination: EmailDestination,
    signal: AbortSignal,
  ): Promise<DeliveryOutcome> {
    if (signal.aborted) return 'not_sent_retryable';
    // LogMailTransport is not evidence of acceptance. Fail closed if SMTP is missing.
    if (!this.config.get('SMTP_URL')) return 'not_sent_permanent';
    const locale = destination.locale === 'en' ? 'en' : 'uk';
    try {
      const url = new URL('/notifications', this.config.getOrThrow('APP_URL'));
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (this.config.get('NODE_ENV') === 'production' && url.protocol !== 'https:')
      )
        return 'not_sent_permanent';
      const result = await this.mailer.send({
        to: { address: destination.email },
        subject:
          locale === 'en'
            ? 'You have an OVRANTO account update'
            : 'У вас є оновлення акаунта OVRANTO',
        template: 'notifications/trainer-review',
        locale,
        context: { url: url.href },
        retry: false,
        signal,
        idempotencyKey: deliveryId,
      });
      return result.accepted.length === 1 && result.accepted[0] === destination.email
        ? 'accepted'
        : 'unknown';
    } catch (error) {
      return classifyEmailFailure(error);
    }
  }
}
