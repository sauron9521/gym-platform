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
import {
  AuthNoStoreInterceptor,
  CredentialsService,
  refreshTokenSchema,
  signInSchema,
  type RefreshTokenInput,
  type SignInInput,
} from '../public-api.js';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@Public()
@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth/token')
export class TokensController {
  constructor(
    private readonly credentialService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  @StableHttpOperation('TokensController', 'issue', 'Tokens', { limit: 3, ttl: 60_000 })
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

  @StableHttpOperation('TokensController', 'refresh', 'Tokens', { limit: 20, ttl: 60_000 })
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ schema: tokenPairResponseSchema })
  refresh(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput) {
    return this.tokenService.refresh(body.refreshToken);
  }

  @StableHttpOperation('TokensController', 'revoke', 'Tokens', { limit: 10, ttl: 60_000 })
  @Post('revoke')
  @HttpCode(204)
  async revoke(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput): Promise<void> {
    await this.tokenService.revoke(body.refreshToken);
  }
}
