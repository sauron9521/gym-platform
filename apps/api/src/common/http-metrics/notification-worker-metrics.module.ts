import { Module } from '@nestjs/common';
import { NotificationWorkerMetricsRegistry } from './notification-worker-metrics.registry.js';

@Module({
  providers: [NotificationWorkerMetricsRegistry],
  exports: [NotificationWorkerMetricsRegistry],
})
export class NotificationWorkerMetricsModule {}
