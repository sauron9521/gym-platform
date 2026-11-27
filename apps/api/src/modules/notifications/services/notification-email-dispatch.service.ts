import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationWorkerMetricsRegistry } from '#src/common/http-metrics/notification-worker-metrics.registry';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { EMAIL_BATCH_LIMIT, EMAIL_SEND_BUDGET_MS } from '../domain/notification-delivery.policy.js';
import { NotificationDeliveryRepository } from '../repositories/notification-delivery.repository.js';
import { NotificationEmailSender } from '../delivery/notification-email.sender.js';

@Injectable()
export class NotificationEmailDispatchService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmailDispatchService.name);
  private draining = false;
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly sender: NotificationEmailSender,
    @Inject(ConfigService) private readonly config: AppConfigService,
    @Optional() private readonly metrics?: NotificationWorkerMetricsRegistry,
  ) {}

  onModuleDestroy() {
    this.draining = true;
  }

  @Cron('*/15 * * * * *', { waitForCompletion: true })
  async dispatch(): Promise<void> {
    if (
      this.draining ||
      this.config.get('NOTIFICATION_DISPATCH_ENABLED') !== true ||
      this.config.get('NOTIFICATION_EMAIL_ENABLED') !== true ||
      !this.config.get('SMTP_URL')
    )
      return;
    const counts = {
      accepted: 0,
      not_sent_retryable: 0,
      not_sent_permanent: 0,
      unknown: 0,
      terminal: 0,
      deferred: 0,
      cancelled: 0,
      lease_lost: 0,
    };
    try {
      for (let i = 0; i < EMAIL_BATCH_LIMIT && !this.draining; i++) {
        const next = await this.repository.claimEmail();
        if (!next) break;
        if (next.kind === 'terminal') {
          counts.terminal++;
          continue;
        }
        const started = performance.now();
        const admission = await this.repository.beginSend(next.claim);
        if (typeof admission === 'string') {
          counts[admission]++;
          continue;
        }
        // Count elapsed transaction time conservatively against both TTL and lease.
        const remaining = Math.floor(
          Math.min(EMAIL_SEND_BUDGET_MS, admission.remainingMs) - (performance.now() - started),
        );
        const sending: boolean = !this.draining && remaining > 0;
        const attemptStarted = performance.now();
        const outcome = sending
          ? await this.sender.send(next.claim.id, admission, AbortSignal.timeout(remaining))
          : 'not_sent_retryable';
        if (sending) this.metrics?.observeEmail((performance.now() - attemptStarted) / 1000);
        const result = await this.repository.complete(next.claim, outcome);
        if (result === 'lease_lost') counts.lease_lost++;
        else counts[outcome]++;
      }
    } catch {
      // A SENDING lease expires to UNKNOWN if DB completion or process fails.
      this.metrics?.batchFailed('email');
      this.logger.error('NOTIFICATION_EMAIL_BATCH_FAILED');
    } finally {
      this.metrics?.recordEmail(counts);
      if (Object.values(counts).some((count) => count > 0))
        this.logger.log({ event: 'NOTIFICATION_EMAIL_BATCH', ...counts });
    }
  }
}
