import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LogMailTransport,
  Mailer,
  MailMessageError,
  MailModule,
  SmtpTransport,
} from '@nestjs/mail';
import { Test } from '@nestjs/testing';
import { createMailOptions } from '../mail.config.js';

const sender = 'Gym API <no-reply@example.test>';

describe('createMailOptions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the existing SMTP transport for Cloudflare', () => {
    const options = createMailOptions(
      {
        NODE_ENV: 'production',
        SMTP_URL: 'smtps://api_token:fixture-only@smtp.mx.cloudflare.net:465',
        MAIL_FROM: 'OVRANTO <noreply@notify.ovranto.com>',
      },
      '/tmp/mail/templates',
    );
    expect(options.transport).toBeInstanceOf(SmtpTransport);
    expect(options.from).toBe('OVRANTO <noreply@notify.ovranto.com>');
  });

  it('rejects any non-allowlisted envelope recipient before SMTP and does not redirect', async () => {
    const send = vi.spyOn(SmtpTransport.prototype, 'send').mockResolvedValue({});
    const mailOptions = createMailOptions(
      {
        NODE_ENV: 'production',
        SMTP_URL: 'smtps://api_token:fixture-only@smtp.mx.cloudflare.net:465',
        MAIL_FROM: sender,
        SMTP_RECIPIENT_ALLOWLIST: 'tester@example.test, other@example.test',
      },
      '/tmp/mail/templates',
    );
    const module = await Test.createTestingModule({
      imports: [MailModule.forRoot(mailOptions)],
    }).compile();
    try {
      const mailer = module.get(Mailer);
      const content = { subject: 'SMTP smoke', text: 'synthetic message' };
      await mailer.send({ ...content, to: 'tester@example.test', cc: 'other@example.test' });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0].envelope.to).toEqual([
        'tester@example.test',
        'other@example.test',
      ]);

      for (const recipients of [
        { to: 'outside@example.test' },
        { to: 'tester@example.test', cc: 'outside@example.test' },
        { to: 'tester@example.test', bcc: 'outside@example.test' },
      ]) {
        await expect(mailer.send({ ...content, ...recipients })).rejects.toBeInstanceOf(
          MailMessageError,
        );
      }
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      await module.close();
    }
  });

  it.each(['development', 'test'] as const)(
    '%s without SMTP uses the log transport',
    (NODE_ENV) => {
      const options = createMailOptions(
        { NODE_ENV, SMTP_URL: undefined, MAIL_FROM: undefined },
        '/tmp/mail/templates',
      );
      expect(options.transport).toBeInstanceOf(LogMailTransport);
      expect(options.from).toBe('Gym Dev <dev@example.test>');
    },
  );

  it('uses encrypted SMTP and configured sender in production', () => {
    const options = createMailOptions(
      {
        NODE_ENV: 'production',
        SMTP_URL: 'smtps://mailer.example.test:465',
        MAIL_FROM: sender,
      },
      '/tmp/mail/templates',
    );
    expect(options.transport).toBeInstanceOf(SmtpTransport);
    expect(options.from).toBe(sender);
  });

  it('refuses a production log fallback', () => {
    expect(() =>
      createMailOptions(
        { NODE_ENV: 'production', SMTP_URL: undefined, MAIL_FROM: sender },
        '/tmp/mail/templates',
      ),
    ).toThrow('Production email requires');
  });

  it('refuses unencrypted SMTP even if validation was bypassed', () => {
    expect(() =>
      createMailOptions(
        {
          NODE_ENV: 'production',
          SMTP_URL: 'smtp://mailer.example.test:587',
          MAIL_FROM: sender,
        },
        '/tmp/mail/templates',
      ),
    ).toThrow('encrypted SMTPS');
  });

  it('uses configured SMTP in development when provided', () => {
    const options = createMailOptions(
      {
        NODE_ENV: 'development',
        SMTP_URL: 'smtp://localhost:1025',
        MAIL_FROM: sender,
      },
      '/tmp/mail/templates',
    );
    expect(options.transport).toBeInstanceOf(SmtpTransport);
  });
});
