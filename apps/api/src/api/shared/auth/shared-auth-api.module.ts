import { Module } from '@nestjs/common';
import { AuthModule } from '#src/modules/auth/auth.module';
import { EmailVerificationResendController } from './controllers/email-verification-resend.controller.js';

@Module({ imports: [AuthModule], controllers: [EmailVerificationResendController] })
export class SharedAuthApiModule {}
