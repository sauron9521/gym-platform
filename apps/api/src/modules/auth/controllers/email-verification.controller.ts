import { CurrentUser, EmailVerificationService, Public } from '@nestjs/authentication';
import {
  BadRequestException,
  Body,
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
  verificationTokenSchema,
  type VerificationTokenInput,
  type VerificationResendActor,
  VerificationResendRateLimitGuard,
} from '../public-api.js';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/email')
export class EmailVerificationController {
  private readonly logger = new Logger(EmailVerificationController.name);

  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  @Public()
  @StableHttpOperation('EmailVerificationController', 'verifyEmail', 'EmailVerification', {
    limit: 8,
    ttl: 60_000,
  })
  @Post('verify')
  @HttpCode(200)
  async verifyEmail(@Body({ schema: verificationTokenSchema }) body: VerificationTokenInput) {
    const verified = await this.emailVerificationService.verify(body.token);
    if (!verified) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { email: verified.email, emailVerified: true };
  }

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
