import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthNoStoreInterceptor,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
  CredentialsService,
  AdminSignInService,
} from '../public-api.js';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';
import { EmailVerificationService, Public, SignInService } from '@nestjs/authentication';
import { RATE_LIMIT_POLICIES } from '#src/common/rate-limit/rate-limit.policies';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import {
  registrationResponseSchema,
  sessionSignInResponseSchema,
} from '#src/infra/openapi/response-contracts';

import { Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@Public()
@ApiTags('Authentication')
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly adminSignInService: AdminSignInService,
  ) {}

  @StableHttpOperation('AuthController', 'signUp', 'Authentication', RATE_LIMIT_POLICIES.auth)
  @Post('register')
  @ApiCreatedResponse({ schema: registrationResponseSchema })
  async signUp(@Body({ schema: signUpSchema }) signUpDto: SignUpInput) {
    const user = await this.credentialsService.register(signUpDto);
    await this.signInService.signIn(user.id, { method: 'password' });

    // Registration and session creation have already committed. A failed
    // email submission must not turn that successful operation into a 500:
    // retrying POST /auth/register would otherwise return 409.
    let verificationEmailStatus: 'SUBMITTED' | 'RETRY_REQUIRED' = 'SUBMITTED';
    try {
      await this.emailVerificationService.send(user);
    } catch {
      // Never log a token, address, provider error or credentials.
      this.logger.warn('AUTH_REGISTRATION_VERIFICATION_EMAIL_SUBMISSION_FAILED');
      verificationEmailStatus = 'RETRY_REQUIRED';
    }

    return { ...user, verificationEmailStatus };
  }

  /**
   * Explicitly issue an admin-purpose cookie only after fresh password proof.
   * The session is still subject to MFA enrollment and CSRF origin checks.
   * Use a generic failure for unknown credentials and non-admin users.
   */
  @StableHttpOperation('AuthController', 'adminSignIn', 'Authentication', RATE_LIMIT_POLICIES.auth)
  @Post('admin-login')
  @UseGuards(AdminOriginGuard)
  @HttpCode(200)
  @ApiOkResponse({ schema: sessionSignInResponseSchema })
  async adminSignIn(
    @Body({ schema: signInSchema }) body: SignInInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminSignInService.signIn(body, request, response);
  }

  @StableHttpOperation('AuthController', 'signIn', 'Authentication', RATE_LIMIT_POLICIES.auth)
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ schema: sessionSignInResponseSchema })
  async signIn(@Body({ schema: signInSchema }) body: SignInInput) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials! Wrong email or password.');
    }

    const { session } = await this.signInService.signIn(user.id, {
      method: 'password',
    });
    return { mfaRequired: session.mfa === 'pending' };
  }
}
