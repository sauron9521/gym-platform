import { EmailVerificationService, Public } from '@nestjs/authentication';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthNoStoreInterceptor,
  verificationTokenSchema,
  type VerificationTokenInput,
} from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/email')
export class EmailVerificationController {
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
}
