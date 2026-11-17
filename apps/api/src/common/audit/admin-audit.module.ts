import { Module } from '@nestjs/common';

import { AdminAuditLogger } from './admin-audit.logger.js';

/**
 * Admin-related feature modules must explicitly import this module
 * to inject the logger. AppModule import alone does not export providers.
 */
@Module({
  providers: [AdminAuditLogger],
  exports: [AdminAuditLogger],
})
export class AdminAuditModule {}
