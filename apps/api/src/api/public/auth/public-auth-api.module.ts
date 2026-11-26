import { Module } from '@nestjs/common';

import { AuthModule } from '#src/modules/auth/auth.module';
import { PasswordResetController } from './controllers/password-reset.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [PasswordResetController],
})
export class PublicAuthApiModule {}
