import { Module } from '@nestjs/common';
import { AccountDeletionRequestsModule } from '#src/modules/account-deletion-requests/account-deletion-requests.module';
import { AccountDeletionRequestsController } from './controllers/account-deletion-requests.controller.js';

@Module({
  imports: [AccountDeletionRequestsModule],
  controllers: [AccountDeletionRequestsController],
})
export class SharedAccountDeletionRequestsApiModule {}
