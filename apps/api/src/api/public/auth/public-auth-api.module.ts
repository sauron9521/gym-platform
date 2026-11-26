import { Module } from '@nestjs/common';

import { AuthModule } from '#src/modules/auth/auth.module';
import { PasswordResetController } from './controllers/password-reset.controller.js';
import { TokensController } from './controllers/tokens.controller.js';
import { EmailVerificationController } from './controllers/email-verification.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [PasswordResetController, TokensController, EmailVerificationController],
})
export class PublicAuthApiModule {}
