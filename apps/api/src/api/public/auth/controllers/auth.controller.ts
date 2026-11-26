import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthNoStoreInterceptor,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
  CredentialsService,
} from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';
import { EmailVerificationService, Public, SignInService } from '@nestjs/authentication';
import { RATE_LIMIT_POLICIES } from '#src/common/rate-limit/rate-limit.policies';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  registrationResponseSchema,
  sessionSignInResponseSchema,
} from '#src/infra/openapi/response-contracts';

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
