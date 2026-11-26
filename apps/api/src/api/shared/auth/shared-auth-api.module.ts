import { Module } from '@nestjs/common';
import { AuthModule } from '#src/modules/auth/auth.module';
import { EmailVerificationResendController } from './controllers/email-verification-resend.controller.js';
import { SessionsController } from './controllers/sessions.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [EmailVerificationResendController, SessionsController],
})
export class SharedAuthApiModule {}
