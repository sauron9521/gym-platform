import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { NotificationRetentionRepository } from '../repositories/notification-retention.repository.js';

@Injectable()
export class NotificationRetentionService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationRetentionService.name);
  private draining = false;

  constructor(
    private readonly repository: NotificationRetentionRepository,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  onModuleDestroy() {
    this.draining = true;
  }

  @Cron('0 */15 * * * *', { waitForCompletion: true })
  async cleanup(): Promise<void> {
    const mode = this.config.get('NOTIFICATION_RETENTION_MODE');
    if (this.draining || (mode !== 'preview' && mode !== 'apply')) return;
    try {
      const result = await this.repository.run(mode);
      this.logger.log({ event: 'NOTIFICATION_RETENTION_BATCH', ...result });
    } catch {
      this.logger.error('NOTIFICATION_RETENTION_BATCH_FAILED');
    }
  }
}
