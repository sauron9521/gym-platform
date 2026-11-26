import { Public } from '@nestjs/authentication';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';
import { RATE_LIMIT_POLICIES } from '#src/common/rate-limit/rate-limit.policies';
import { sessionSignInResponseSchema } from '#src/infra/openapi/response-contracts';
import {
  AdminSignInService,
  AuthNoStoreInterceptor,
  signInSchema,
  type SignInInput,
} from '#src/modules/auth/public-api';

@Public()
@ApiTags('Authentication')
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class AdminAuthController {
  constructor(private readonly adminSignInService: AdminSignInService) {}

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
}
