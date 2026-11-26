import { CurrentUser, EmailVerificationService } from '@nestjs/authentication';
import {
  ConflictException,
  Controller,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthNoStoreInterceptor,
  type VerificationResendActor,
  VerificationResendRateLimitGuard,
} from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/email')
export class EmailVerificationResendController {
  // Preserve the existing log category for operational continuity.
  private readonly logger = new Logger('EmailVerificationController');

  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  @UseGuards(VerificationResendRateLimitGuard)
  @StableHttpOperation('EmailVerificationController', 'resend', 'EmailVerification', {
    limit: 3,
    ttl: 60_000,
  })
  @Post('verification')
  @HttpCode(202)
  async resend(@CurrentUser() user: VerificationResendActor): Promise<void> {
    if (user.emailVerified) {
      throw new ConflictException('Email address already verified');
    }
    try {
      await this.emailVerificationService.send(user);
    } catch {
      // Do not expose or log email addresses, verification links or SMTP errors.
      this.logger.warn('AUTH_VERIFICATION_EMAIL_RESEND_FAILED');
      throw new ServiceUnavailableException(
        'Verification email is temporarily unavailable. Please retry later.',
      );
    }
  }
}
