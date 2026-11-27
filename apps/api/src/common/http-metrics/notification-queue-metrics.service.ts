import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { NotificationWorkerMetricsRegistry } from './notification-worker-metrics.registry.js';

export const QUEUE_METRIC_COUNT_CAP = 10_001;
export const QUEUE_METRIC_CACHE_MS = 30_000;

const outboxStates = ['PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER'] as const;
const deliveryStates = [
  'PENDING',
  'CLAIMED',
  'SENDING',
  'SENT',
  'CANCELLED',
  'DEAD_LETTER',
  'UNKNOWN',
] as const;
const bounded = (where: Prisma.Sql) =>
  Prisma.sql`(SELECT count(*)::int FROM (SELECT 1 ${where} LIMIT ${QUEUE_METRIC_COUNT_CAP}) AS bounded)`;
const states = [
  ...outboxStates.map((status) => ({
    metric: 'gym_api_notification_queue_rows{queue="outbox",state="' + status.toLowerCase() + '"}',
    value: bounded(Prisma.sql`FROM outbox_events WHERE status = ${status}::"OutboxEventStatus"`),
  })),
  ...deliveryStates.map((status) => ({
    metric:
      'gym_api_notification_queue_rows{queue="delivery",state="' + status.toLowerCase() + '"}',
    value: bounded(
      Prisma.sql`FROM notification_deliveries WHERE status = ${status}::"NotificationDeliveryStatus"`,
    ),
  })),
];
const samples = [
  ...states,
  {
    metric: 'gym_api_notification_due_rows{queue="outbox"}',
    value: bounded(
      Prisma.sql`FROM outbox_events WHERE status='PENDING' AND available_at <= statement_timestamp()`,
    ),
  },
  {
    metric: 'gym_api_notification_due_rows{queue="delivery"}',
    value: bounded(
      Prisma.sql`FROM notification_deliveries WHERE status='PENDING' AND available_at <= statement_timestamp()`,
    ),
  },
  {
    metric: 'gym_api_notification_oldest_due_seconds{queue="outbox"}',
    value: Prisma.sql`COALESCE((SELECT EXTRACT(EPOCH FROM statement_timestamp() - available_at)::float8 FROM outbox_events WHERE status='PENDING' AND available_at <= statement_timestamp() ORDER BY available_at LIMIT 1), 0)`,
  },
  {
    metric: 'gym_api_notification_oldest_due_seconds{queue="delivery"}',
    value: Prisma.sql`COALESCE((SELECT EXTRACT(EPOCH FROM statement_timestamp() - available_at)::float8 FROM notification_deliveries WHERE status='PENDING' AND available_at <= statement_timestamp() ORDER BY available_at LIMIT 1), 0)`,
  },
  {
    metric: 'gym_api_notification_expired_leases{queue="outbox"}',
    value: bounded(
      Prisma.sql`FROM outbox_events WHERE status='PROCESSING' AND (lease_until IS NULL OR lease_until <= statement_timestamp())`,
    ),
  },
  {
    metric: 'gym_api_notification_expired_leases{queue="delivery"}',
    value: bounded(
      Prisma.sql`FROM notification_deliveries WHERE status IN ('CLAIMED','SENDING') AND lease_until <= statement_timestamp()`,
    ),
  },
  {
    metric: 'gym_api_notification_expired_pending_deliveries',
    value: bounded(
      Prisma.sql`FROM notification_deliveries WHERE status='PENDING' AND expires_at <= statement_timestamp()`,
    ),
  },
];
const metadata = [
  [
    'gym_api_notification_queue_rows',
    'Stored rows by state, capped at 10001 (a lower bound when saturated).',
  ],
  ['gym_api_notification_due_rows', 'Pending rows currently due by available_at, capped at 10001.'],
  [
    'gym_api_notification_oldest_due_seconds',
    'Age since earliest due available_at; zero when none.',
  ],
  ['gym_api_notification_expired_leases', 'Expired or abandoned worker leases, capped at 10001.'],
  [
    'gym_api_notification_expired_pending_deliveries',
    'Expired pending transport rows, capped at 10001.',
  ],
] as const;

// One read-only statement; fixed query plan, bounded counting and database clock.
// Returned values are numeric only; metric names are from the constant schema.
const query = Prisma.sql`SELECT ARRAY[${Prisma.join(samples.map((sample) => Prisma.sql`${sample.value}::float8`))}] AS values`;
type Snapshot = { success: boolean; values: number[]; finishedAt: number };

@Injectable()
export class NotificationQueueMetricsService {
  private cached?: Snapshot;
  private inFlight?: Promise<Snapshot>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: AppConfigService,
    private readonly workers: NotificationWorkerMetricsRegistry,
  ) {}

  private async collect(): Promise<Snapshot> {
    try {
      const values = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`;
          await tx.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
          const [row] = await tx.$queryRaw<{ values: number[] }[]>(query);
          if (
            !row ||
            row.values.length !== samples.length ||
            row.values.some((n) => !Number.isFinite(n) || n < 0)
          )
            throw new Error('Invalid queue metric snapshot');
          return row.values;
        },
        { maxWait: 500, timeout: 2500 },
      );
      return { success: true, values, finishedAt: performance.now() };
    } catch {
      // No database error text or stale successful gauges. Back off failures too.
      return { success: false, values: [], finishedAt: performance.now() };
    }
  }
  private async snapshot(): Promise<Snapshot> {
    if (this.cached && performance.now() - this.cached.finishedAt < QUEUE_METRIC_CACHE_MS)
      return this.cached;
    if (!this.inFlight) {
      this.inFlight = this.collect()
        .then((result) => {
          this.cached = result;
          return result;
        })
        .finally(() => {
          this.inFlight = undefined;
        });
    }
    return this.inFlight;
  }

  async render(): Promise<string> {
    const snapshot = await this.snapshot();
    const dispatch = this.config.get('NOTIFICATION_DISPATCH_ENABLED') === true;
    const email =
      dispatch &&
      this.config.get('NOTIFICATION_EMAIL_ENABLED') === true &&
      !!this.config.get('SMTP_URL');
    const lines = [
      '# HELP gym_api_notification_queue_snapshot_success Latest bounded queue read succeeded (1) or failed (0).',
      '# TYPE gym_api_notification_queue_snapshot_success gauge',
      'gym_api_notification_queue_snapshot_success ' + Number(snapshot.success),
      '# HELP gym_api_notification_worker_enabled Effective configuration for the worker.',
      '# TYPE gym_api_notification_worker_enabled gauge',
      'gym_api_notification_worker_enabled{worker="outbox"} ' + Number(dispatch),
      'gym_api_notification_worker_enabled{worker="email"} ' + Number(email),
    ];
    if (snapshot.success) {
      for (const [name, help] of metadata) {
        lines.push('# HELP ' + name + ' ' + help, '# TYPE ' + name + ' gauge');
        for (const [i, sample] of samples.entries()) {
          if (sample.metric === name || sample.metric.startsWith(name + '{'))
            lines.push(sample.metric + ' ' + snapshot.values[i]);
        }
      }
    }
    return lines.join('\n') + '\n' + this.workers.render();
  }
}
