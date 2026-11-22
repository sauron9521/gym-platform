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
import { AuthNoStoreInterceptor } from '../interceptors/auth-no-store.interceptor.js';
import { EmailVerificationService, Public, SignInService } from '@nestjs/authentication';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import {
  registrationResponseSchema,
  sessionSignInResponseSchema,
} from '#src/infra/openapi/response-contracts';
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '../dto/auth.schemas.js';
import { CredentialsService } from '../services/index.js';

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
  ) {}

  @RateLimit('auth')
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
  @RateLimit('auth')
  @Post('admin-login')
  @UseGuards(AdminOriginGuard)
  @HttpCode(200)
  @ApiOkResponse({ schema: sessionSignInResponseSchema })
  async adminSignIn(@Body({ schema: signInSchema }) body: SignInInput) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { session } = await this.signInService.signIn(user.id, {
      method: 'password',
      metadata: { purpose: ADMIN_SESSION_PURPOSE },
    });
    return { mfaRequired: session.mfa === 'pending' };
  }

  @RateLimit('auth')
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
