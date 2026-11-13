import { Public, TokenService } from '@nestjs/authentication';
import { ApiOkResponse } from '@nestjs/swagger';
import { tokenPairResponseSchema } from '#src/infra/openapi/response-contracts';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { AuthNoStoreInterceptor } from '../interceptors/auth-no-store.interceptor.js';
import { CredentialsService } from '../services/index.js';
import {
  refreshTokenSchema,
  signInSchema,
  type RefreshTokenInput,
  type SignInInput,
} from '../dto/auth.schemas.js';
import { Throttle } from '@nestjs/throttler';

@Public()
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/token')
export class TokensController {
  constructor(
    private readonly credentialService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ schema: tokenPairResponseSchema })
  async issue(@Body({ schema: signInSchema }) body: SignInInput) {
    const user = await this.credentialService.verify(body.email, body.password);

    if (!user) {
      throw new UnauthorizedException();
    }
    return this.tokenService.issue(user.id, {
      method: 'password',
      claims: { amr: ['pwd'] },
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ schema: tokenPairResponseSchema })
  refresh(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput) {
    return this.tokenService.refresh(body.refreshToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('revoke')
  @HttpCode(204)
  async revoke(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput): Promise<void> {
    await this.tokenService.revoke(body.refreshToken);
  }
}
