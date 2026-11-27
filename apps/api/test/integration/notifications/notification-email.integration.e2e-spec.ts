import { randomUUID } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MailModule, Mailer, FileTemplateEngine, SmtpTransport } from '@nestjs/mail';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppEnv } from '../../../src/common/config/env.schema.js';
import { PrismaService } from '../../../src/infra/database/index.js';
import { TrainerReviewRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-review.repository.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { NotificationDeliveryRepository } from '../../../src/modules/notifications/repositories/notification-delivery.repository.js';
import { NotificationEmailSender } from '../../../src/modules/notifications/delivery/notification-email.sender.js';
import { NotificationEmailDispatchService } from '../../../src/modules/notifications/services/notification-email-dispatch.service.js';
import { useTestDatabase } from '../../utility/test-db-helper.js';

// A loopback-only SMTP peer exercises the installed @nestjs/mail transport,
// including the real DATA acceptance boundary, without outside email delivery.
type Mode = 'accept' | 'temporary' | 'permanent' | 'lost-data-reply';
function smtpPeer() {
  let mode: Mode = 'accept';
  const messages: { to: string; mime: string }[] = [];
  const sockets = new Set<Socket>();
  let connections = 0;
  const server = createServer((socket) => {
    sockets.add(socket);
    connections++;
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP test\r\n');
    let buffer = '',
      to = '',
      mime = '',
      data = false;
    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') {
            data = false;
            messages.push({ to, mime });
            if (mode === 'lost-data-reply') {
              socket.destroy();
              return;
            }
            socket.write('250 2.0.0 Accepted\r\n');
          } else mime += line + '\r\n';
          continue;
        }
        if (/^(EHLO|HELO) /i.test(line)) socket.write('250 localhost\r\n');
        else if (/^MAIL FROM:/i.test(line)) socket.write('250 OK\r\n');
        else if (/^RCPT TO:/i.test(line)) {
          to = line;
          socket.write(
            mode === 'temporary'
              ? '451 4.3.0 Try later\r\n'
              : mode === 'permanent'
                ? '550 5.1.1 Refused\r\n'
                : '250 OK\r\n',
          );
        } else if (line === 'DATA') {
          data = true;
          mime = '';
          socket.write('354 End with dot\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 Bye\r\n');
          return;
        } else if (line === 'RSET') socket.write('250 OK\r\n');
        else socket.write('500 Unsupported\r\n');
      }
    });
  });
  return {
    messages,
    get connections() {
      return connections;
    },
    reset(next: Mode = 'accept') {
      mode = next;
      messages.length = 0;
      connections = 0;
    },
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected loopback listener');
      return 'smtp://127.0.0.1:' + address.port;
    },
    async stop() {
      for (const socket of sockets) socket.destroy();
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    },
  };
}

describe('Optional notification email from committed review (PostgreSQL + SMTP)', () => {
  const owner = randomUUID(),
    reviewer = randomUUID();
  const old = new Date('1996-01-01T00:00:00.000Z');
  const peer = smtpPeer();
  let prisma: PrismaService;
  let module: TestingModule;
  let config: ConfigService<AppEnv, true>;
  let reviews: TrainerReviewRepository;
  let outbox: OutboxDispatchRepository;
  let repo: NotificationDeliveryRepository;
  let worker: NotificationEmailDispatchService;
  beforeAll(async () => {
    useTestDatabase();
    const url = await peer.start();
    config = new ConfigService<AppEnv, true>({
      DATABASE_URL: process.env.DATABASE_URL!,
      APP_URL: 'http://localhost:3200',
      NODE_ENV: 'test',
      SMTP_URL: url,
      NOTIFICATION_DISPATCH_ENABLED: true,
      NOTIFICATION_EMAIL_ENABLED: true,
    });
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    module = await Test.createTestingModule({
      imports: [
        MailModule.forRoot({
          transport: new SmtpTransport({ url }),
          templates: new FileTemplateEngine({
            dir: join(import.meta.dirname, '../../../src/mail/templates'),
          }),
          from: 'OVRANTO <sender@example.test>',
        }),
      ],
    }).compile();
    reviews = new TrainerReviewRepository(prisma);
    outbox = new OutboxDispatchRepository(
      prisma,
      new ConfigService({
        SMTP_URL: url,
        NOTIFICATION_DISPATCH_ENABLED: true,
        NOTIFICATION_EMAIL_ENABLED: true,
      }),
    );
    repo = new NotificationDeliveryRepository(prisma);
    worker = new NotificationEmailDispatchService(
      repo,
      new NotificationEmailSender(module.get(Mailer), config),
      config,
    );
    await prisma.user.createMany({
      data: [
        {
          id: owner,
          email: owner + '@example.test',
          passwordHash: 'test-only',
          emailVerified: true,
          preferredLocale: 'en',
        },
        {
          id: reviewer,
          email: reviewer + '@example.test',
          passwordHash: 'test-only',
          emailVerified: true,
          role: 'ADMIN',
        },
      ],
    });
  });
  beforeEach(() => peer.reset());
  async function cleanup() {
    await prisma.notification.deleteMany({ where: { recipientId: owner } });
    await prisma.outboxEvent.deleteMany({ where: { actorUserId: reviewer } });
    await prisma.trainerApplication.deleteMany({ where: { userId: owner } });
    await prisma.trainerProfile.deleteMany({ where: { userId: owner } });
    await prisma.notificationPreference.deleteMany({ where: { userId: owner } });
    await prisma.notificationSettings.deleteMany({ where: { userId: owner } });
    await prisma.profile.deleteMany({ where: { userId: owner } });
    await prisma.user.update({
      where: { id: owner },
      data: {
        email: owner + '@example.test',
        emailVerified: true,
        preferredLocale: 'en',
        status: 'ACTIVE',
      },
    });
  }
  afterEach(cleanup);
  afterAll(async () => {
    try {
      if (prisma) {
        await cleanup();
        await prisma.user.deleteMany({ where: { id: { in: [owner, reviewer] } } });
      }
    } finally {
      await module?.close();
      await peer.stop();
      await prisma?.onApplicationShutdown();
    }
  });
  async function preferences(consent: boolean) {
    await prisma.notificationSettings.create({ data: { userId: owner, quietHoursEnabled: false } });
    if (consent)
      await prisma.notificationPreference.create({
        data: {
          userId: owner,
          category: 'ACCOUNT',
          channel: 'EMAIL',
          enabled: true,
          consentedAt: old,
        },
      });
  }
  async function publish(consent = true, dispatcher = outbox) {
    await preferences(consent);
    const application = await prisma.trainerApplication.create({
      data: { userId: owner, applicantNote: '<script>secret application</script>' },
    });
    expect(
      (await reviews.decide(application.id, reviewer, 'REJECT', '<img src=x>private review')).kind,
    ).toBe('ok');
    expect(
      (await reviews.decide(application.id, reviewer, 'REJECT', '<img src=x>private review')).kind,
    ).toBe('ok');
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: {
        eventKey: 'trainer-application:' + application.id + ':trainer.application.reviewed:v1',
      },
    });
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: old } });
    const claim = await dispatcher.claim();
    expect(claim?.id).toBe(event.id);
    expect(await dispatcher.process(claim!)).toBe('processed');
    const notification = await prisma.notification.findFirstOrThrow({
      where: { eventId: event.id, recipientId: owner },
    });
    return { event, notification, application };
  }
  const delivery = (notificationId: string) =>
    prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId } });

  it('plans exactly once, selects current verified address and locale, sends one generic message', async () => {
    const { event, notification, application } = await publish();
    const original = await delivery(notification.id);
    expect(original).toMatchObject({
      status: 'PENDING',
      attemptCount: 0,
      destinationKey: 'account-email',
    });
    expect(peer.connections).toBe(0);
    // Replaying the committed outbox must not create another logical delivery.
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PENDING', availableAt: old, processedAt: null },
    });
    expect(await outbox.process((await outbox.claim())!)).toBe('processed');
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: notification.id } }),
    ).toBe(1);
    const address = 'changed-' + owner + '@example.test';
    await prisma.user.update({
      where: { id: owner },
      data: { email: address, preferredLocale: 'en' },
    });
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({
      status: 'SENT',
      attemptCount: 1,
      lastErrorCode: null,
    });
    expect(peer.messages).toHaveLength(1);
    expect(peer.messages[0]!.to).toContain(address);
    const mime = peer.messages[0]!.mime;
    expect(mime).toContain('http://localhost:3200/notifications');
    expect(mime).toContain('You have an OVRANTO account update');
    expect(mime).not.toContain(application.id);
    expect(mime).not.toContain('private review');
    expect(mime).not.toContain('secret application');
    expect(JSON.stringify(await delivery(notification.id))).not.toContain(address);
    await worker.dispatch();
    expect(peer.messages).toHaveLength(1);
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).toEqual(
      notification,
    );
  });

  it('does not plan without consent or when the channel is disabled', async () => {
    const { notification } = await publish(false);
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: notification.id } }),
    ).toBe(0);
    await worker.dispatch();
    expect(peer.connections).toBe(0);
    await cleanup();
    const disabled = new OutboxDispatchRepository(
      prisma,
      new ConfigService({
        NOTIFICATION_DISPATCH_ENABLED: true,
        NOTIFICATION_EMAIL_ENABLED: false,
        SMTP_URL: config.get('SMTP_URL'),
      }),
    );
    const off = await publish(true, disabled);
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: off.notification.id } }),
    ).toBe(0);
    await worker.dispatch();
    expect(peer.connections).toBe(0);
  });

  it('defers quiet hours and cancels revoked consent without SMTP', async () => {
    const { notification } = await publish();
    const minute = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    await prisma.notificationSettings.update({
      where: { userId: owner },
      data: {
        quietHoursEnabled: true,
        quietStartMinute: (minute + 1430) % 1440,
        quietEndMinute: (minute + 10) % 1440,
      },
    });
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({
      status: 'PENDING',
      attemptCount: 0,
      lastErrorCode: 'QUIET_HOURS',
    });
    expect(peer.connections).toBe(0);
    await prisma.notificationPreference.updateMany({
      where: { userId: owner },
      data: { enabled: false, consentedAt: null },
    });
    await prisma.notificationDelivery.update({
      where: { id: (await delivery(notification.id)).id },
      data: { availableAt: old },
    });
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({ status: 'CANCELLED', attemptCount: 0 });
    expect(peer.connections).toBe(0);
  });

  it('bounds a definite transient failure to one attempt per claim and retries after backoff', async () => {
    const { notification } = await publish();
    peer.reset('temporary');
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({
      status: 'PENDING',
      attemptCount: 1,
      lastErrorCode: 'RETRYABLE_NOT_SENT',
    });
    expect(peer.connections).toBe(1);
    expect(peer.messages).toHaveLength(0);
    await worker.dispatch();
    expect(peer.connections).toBe(1);
    await prisma.notificationDelivery.update({
      where: { id: (await delivery(notification.id)).id },
      data: { availableAt: old },
    });
    peer.reset();
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({ status: 'SENT', attemptCount: 2 });
    expect(peer.messages).toHaveLength(1);
  });

  it.each([
    ['permanent', 'DEAD_LETTER'],
    ['lost-data-reply', 'UNKNOWN'],
  ] as const)('never automatically resends %s', async (mode, status) => {
    const { notification } = await publish();
    peer.reset(mode);
    await worker.dispatch();
    expect(await delivery(notification.id)).toMatchObject({ status, attemptCount: 1 });
    expect(peer.connections).toBe(1);
    await worker.dispatch();
    expect(peer.connections).toBe(1);
  });

  it('renders both deterministic HTML/text templates with escaped values and no review details', async () => {
    const engine = new FileTemplateEngine({
      dir: join(import.meta.dirname, '../../../src/mail/templates'),
    });
    for (const locale of ['en', 'uk']) {
      const result = await engine.render(
        'notifications/trainer-review',
        { url: 'https://example.test/notifications?x="><script>bad</script>' },
        { locale },
      );
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.text).toContain('https://example.test/notifications');
      expect(result.html).not.toContain('private review');
    }
  });
});
