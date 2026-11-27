import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MailConnectionError,
  MailMessageError,
  MailSmtpError,
  MailTemplateError,
  MailTimeoutError,
  type Mailer,
} from '@nestjs/mail';
import type { AppEnv } from '#src/common/config/env.schema';
import {
  classifyEmailFailure,
  NotificationEmailSender,
} from '../delivery/notification-email.sender.js';
import { EMAIL_BATCH_LIMIT } from '../domain/notification-delivery.policy.js';
import type { NotificationDeliveryRepository } from '../repositories/notification-delivery.repository.js';
import { NotificationEmailDispatchService } from '../services/notification-email-dispatch.service.js';

const claim = { id: 'delivery-id', token: 'private-claim' };
const destination = { email: 'recipient@example.test', locale: 'en' as const };
const ready = { kind: 'ready', ...destination, remainingMs: 30_000 };
const config = (overrides: Partial<AppEnv> = {}) =>
  new ConfigService<AppEnv, true>({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    SMTP_URL: 'smtp://localhost:1025',
    NOTIFICATION_DISPATCH_ENABLED: true,
    NOTIFICATION_EMAIL_ENABLED: true,
    ...overrides,
  });

describe('NotificationEmailSender', () => {
  it('uses only the fixed inbox link, localized template and one abortable attempt', async () => {
    const mailer = { send: vi.fn().mockResolvedValue({ accepted: [destination.email] }) };
    const sender = new NotificationEmailSender(mailer as unknown as Mailer, config());
    const signal = new AbortController().signal;
    expect(await sender.send(claim.id, destination, signal)).toBe('accepted');
    expect(mailer.send).toHaveBeenCalledExactlyOnceWith({
      to: { address: destination.email },
      subject: 'You have an OVRANTO account update',
      template: 'notifications/trainer-review',
      locale: 'en',
      context: { url: 'http://localhost:3000/notifications' },
      retry: false,
      signal,
      idempotencyKey: claim.id,
    });
    expect(await sender.send(claim.id, { ...destination, locale: 'uk' }, signal)).toBe('accepted');
    expect(mailer.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ locale: 'uk', subject: 'У вас є оновлення акаунта OVRANTO' }),
    );
  });

  it('refuses log fallback, aborted admission and unsafe app origins', async () => {
    const mailer = { send: vi.fn() };
    const signal = new AbortController().signal;
    const create = (overrides: Partial<AppEnv>) =>
      new NotificationEmailSender(mailer as unknown as Mailer, config(overrides));
    expect(await create({ SMTP_URL: undefined }).send(claim.id, destination, signal)).toBe(
      'not_sent_permanent',
    );
    expect(
      await create({ APP_URL: 'https://user:pw@example.test' }).send(claim.id, destination, signal),
    ).toBe('not_sent_permanent');
    expect(await create({ NODE_ENV: 'production' }).send(claim.id, destination, signal)).toBe(
      'not_sent_permanent',
    );
    const abort = new AbortController();
    abort.abort();
    expect(await create({}).send(claim.id, destination, abort.signal)).toBe('not_sent_retryable');
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('accepts only a single matching provider recipient', async () => {
    const mailer = { send: vi.fn() };
    const sender = new NotificationEmailSender(mailer as unknown as Mailer, config());
    for (const accepted of [
      [],
      ['wrong@example.test'],
      [destination.email, 'wrong@example.test'],
    ]) {
      mailer.send.mockResolvedValueOnce({ accepted });
      expect(await sender.send(claim.id, destination, new AbortController().signal)).toBe(
        'unknown',
      );
    }
  });

  it('retries only definitely refused SMTP attempts; lost DATA replies remain unknown', () => {
    const reply = (command: string, code: number) =>
      new MailSmtpError(command, { code, text: 'private provider text' });
    expect(classifyEmailFailure(reply('RCPT TO', 451))).toBe('not_sent_retryable');
    expect(classifyEmailFailure(reply('DATA', 452))).toBe('not_sent_retryable');
    expect(classifyEmailFailure(reply('DATA', 550))).toBe('not_sent_permanent');
    expect(classifyEmailFailure(reply('QUIT', 451))).toBe('unknown');
    expect(classifyEmailFailure(new MailMessageError('to', 'invalid'))).toBe('not_sent_permanent');
    expect(classifyEmailFailure(new MailTemplateError('missing'))).toBe('not_sent_permanent');
    expect(classifyEmailFailure(new MailTimeoutError('greeting', 100))).toBe('not_sent_retryable');
    expect(classifyEmailFailure(new MailTimeoutError('data', 100))).toBe('unknown');
    expect(classifyEmailFailure(new MailConnectionError('closed', { permanent: false }))).toBe(
      'unknown',
    );
    expect(
      classifyEmailFailure(
        new MailConnectionError('refused', {
          permanent: false,
          cause: Object.assign(new Error(), { code: 'ECONNREFUSED' }),
        }),
      ),
    ).toBe('not_sent_retryable');
    expect(classifyEmailFailure(new Error('unknown'))).toBe('unknown');
  });
});

describe('NotificationEmailDispatchService', () => {
  function setup(overrides: Partial<AppEnv> = {}) {
    const repository = {
      claimEmail: vi.fn().mockResolvedValue({ kind: 'claimed', claim }),
      beginSend: vi.fn().mockResolvedValue(ready),
      complete: vi.fn().mockResolvedValue('recorded'),
    };
    const sender = { send: vi.fn().mockResolvedValue('accepted') };
    const service = new NotificationEmailDispatchService(
      repository as unknown as NotificationDeliveryRepository,
      sender as unknown as NotificationEmailSender,
      config(overrides),
    );
    return { repository, sender, service };
  }
  afterEach(() => vi.restoreAllMocks());

  it('requires both opt-ins and SMTP before claiming anything', async () => {
    for (const options of [
      { NOTIFICATION_EMAIL_ENABLED: false },
      { NOTIFICATION_DISPATCH_ENABLED: false },
      { SMTP_URL: undefined },
    ]) {
      const { repository, service } = setup(options);
      await service.dispatch();
      expect(repository.claimEmail).not.toHaveBeenCalled();
    }
  });

  it('sends admitted work only, records the outcome and bounds the batch', async () => {
    const { repository, sender, service } = setup();
    await service.dispatch();
    expect(repository.claimEmail).toHaveBeenCalledTimes(EMAIL_BATCH_LIMIT);
    expect(sender.send).toHaveBeenCalledTimes(EMAIL_BATCH_LIMIT);
    expect(sender.send).toHaveBeenCalledWith(claim.id, ready, expect.any(AbortSignal));
    expect(repository.complete).toHaveBeenCalledWith(claim, 'accepted');
    service.onModuleDestroy();
    await service.dispatch();
    expect(repository.claimEmail).toHaveBeenCalledTimes(EMAIL_BATCH_LIMIT);
  });

  it('skips terminal, quiet, revoked and lost claims without SMTP', async () => {
    const { repository, sender, service } = setup();
    repository.claimEmail
      .mockResolvedValueOnce({ kind: 'terminal' })
      .mockResolvedValueOnce({ kind: 'claimed', claim })
      .mockResolvedValueOnce({ kind: 'claimed', claim })
      .mockResolvedValueOnce({ kind: 'claimed', claim })
      .mockResolvedValue(null);
    repository.beginSend
      .mockResolvedValueOnce('deferred')
      .mockResolvedValueOnce('cancelled')
      .mockResolvedValueOnce('lease_lost');
    await service.dispatch();
    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('does not start SMTP if admission consumed the time budget or shutdown began', async () => {
    const { repository, sender, service } = setup();
    repository.beginSend
      .mockImplementationOnce(async () => ({ ...ready, remainingMs: 0 }))
      .mockImplementationOnce(async () => {
        service.onModuleDestroy();
        return ready;
      });
    await service.dispatch();
    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.complete).toHaveBeenCalledTimes(2);
    expect(repository.complete).toHaveBeenCalledWith(claim, 'not_sent_retryable');
  });

  it('never repeats an ambiguous send after completion fails and logs no PII', async () => {
    const { repository, sender, service } = setup();
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    sender.send.mockResolvedValueOnce('unknown');
    repository.complete.mockRejectedValueOnce(new Error('secret recipient@example.test'));
    await service.dispatch();
    expect(sender.send).toHaveBeenCalledOnce();
    expect(repository.claimEmail).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledExactlyOnceWith('NOTIFICATION_EMAIL_BATCH_FAILED');
    expect(JSON.stringify([log.mock.calls, error.mock.calls])).not.toContain(
      'recipient@example.test',
    );
  });
});
