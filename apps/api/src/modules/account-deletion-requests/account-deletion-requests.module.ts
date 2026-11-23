import { Module } from '@nestjs/common';
import { RateLimitStorageModule } from '#src/common/rate-limit/rate-limit-storage.module';
import { AccountDeletionRequestsController } from './controllers/account-deletion-requests.controller.js';
import { AccountDeletionRequestsRepository } from './repositories/account-deletion-requests.repository.js';
import { AccountDeletionRequestsService } from './services/account-deletion-requests.service.js';

@Module({
  imports: [RateLimitStorageModule],
  controllers: [AccountDeletionRequestsController],
  providers: [AccountDeletionRequestsRepository, AccountDeletionRequestsService],
})
export class AccountDeletionRequestsModule {}
