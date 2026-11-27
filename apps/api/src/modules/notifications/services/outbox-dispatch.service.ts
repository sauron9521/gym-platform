import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { OUTBOX_BATCH_LIMIT } from '../domain/outbox-dispatch.policy.js';
import { OutboxDispatchRepository } from '../repositories/outbox-dispatch.repository.js';

@Injectable()
export class OutboxDispatchService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatchService.name);
  private draining = false;

  constructor(
    private readonly repository: OutboxDispatchRepository,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  onModuleDestroy() {
    this.draining = true;
  }

  @Cron('*/15 * * * * *', { waitForCompletion: true })
  async dispatch(): Promise<void> {
    if (this.draining || this.config.get('NOTIFICATION_DISPATCH_ENABLED') !== true) return;
    const counts = { processed: 0, skipped: 0, dead_letter: 0, lease_lost: 0, retry: 0 };
    try {
      for (let i = 0; i < OUTBOX_BATCH_LIMIT && !this.draining; i++) {
        const claim = await this.repository.claim();
        if (!claim) break;
        if (claim.status === 'DEAD_LETTER') {
          counts.dead_letter++;
          continue;
        }
        try {
          counts[await this.repository.process(claim)]++;
        } catch {
          counts[await this.repository.retry(claim)]++;
        }
      }
    } catch {
      // Leases expire even when the DB is unavailable for the retry write.
      this.logger.error('NOTIFICATION_DISPATCH_BATCH_FAILED');
    } finally {
      if (Object.values(counts).some((count) => count > 0)) {
        this.logger.log({ event: 'NOTIFICATION_DISPATCH_BATCH', ...counts });
      }
    }
  }
}
