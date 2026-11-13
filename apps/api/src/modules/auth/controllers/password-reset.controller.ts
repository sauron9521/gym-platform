import { PasswordResetService, Public } from '@nestjs/authentication';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthNoStoreInterceptor } from '../interceptors/auth-no-store.interceptor.js';
import { Throttle } from '@nestjs/throttler';
import {
  emailSchema,
  resetPasswordSchema,
  type EmailInput,
  type ResetPasswordInput,
} from '../dto/auth.schemas.js';
import { AccountRecoveryRateLimitGuard } from '../guards/account-recovery-rate-limit.guard.js';

@Public()
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AccountRecoveryRateLimitGuard)
  @Post('forgot')
  @HttpCode(202)
  async forgot(@Body({ schema: emailSchema }) body: EmailInput): Promise<void> {
    return this.passwordResetService.request(body.email);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('reset')
  @HttpCode(200)
  async reset(@Body({ schema: resetPasswordSchema }) body: ResetPasswordInput) {
    const result = await this.passwordResetService.reset(body.token, body.password, {
      signIn: true,
    });
    if (!result) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { mfaRequired: result.signedIn?.session.mfa === 'pending' };
  }
}
