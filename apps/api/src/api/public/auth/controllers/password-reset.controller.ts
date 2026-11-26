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
import {
  AuthNoStoreInterceptor,
  emailSchema,
  resetPasswordSchema,
  type EmailInput,
  type ResetPasswordInput,
  AccountRecoveryRateLimitGuard,
} from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@Public()
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @UseGuards(AccountRecoveryRateLimitGuard)
  @StableHttpOperation('PasswordResetController', 'forgot', 'PasswordReset', {
    limit: 3,
    ttl: 60_000,
  })
  @Post('forgot')
  @HttpCode(202)
  async forgot(@Body({ schema: emailSchema }) body: EmailInput): Promise<void> {
    return this.passwordResetService.request(body.email);
  }

  @StableHttpOperation('PasswordResetController', 'reset', 'PasswordReset', {
    limit: 3,
    ttl: 60_000,
  })
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
