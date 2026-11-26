import { Module } from '@nestjs/common';
import { RateLimitStorageModule } from '#src/common/rate-limit/rate-limit-storage.module';
import { AccountDeletionRequestsRepository } from './repositories/account-deletion-requests.repository.js';
import { AccountDeletionRequestsService } from './services/account-deletion-requests.service.js';

@Module({
  imports: [RateLimitStorageModule],
  controllers: [],
  providers: [AccountDeletionRequestsRepository, AccountDeletionRequestsService],
  exports: [AccountDeletionRequestsService],
})
export class AccountDeletionRequestsModule {}
