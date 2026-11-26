import {
  CurrentSession,
  CurrentUser,
  Public,
  SessionService,
  SignInService,
  type SessionRecord,
} from '@nestjs/authentication';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { AuthNoStoreInterceptor } from '../public-api.js';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly signInService: SignInService,
  ) {}

  @StableHttpOperation('SessionsController', 'list', 'Sessions')
  @Get('sessions')
  async list(
    @CurrentUser('id') userId: string,
    @CurrentSession() current: SessionRecord | undefined,
  ) {
    const sessions = await this.sessionService.list(userId);

    return sessions.map(({ id, createdAt, lastActiveAt, metadata }) => ({
      id,
      createdAt,
      lastActiveAt,
      userAgent: metadata?.userAgent ?? null,
      current: id === current?.id,
    }));
  }

  // A user may revoke only their own sessions.
  @StableHttpOperation('SessionsController', 'revoke', 'Sessions')
  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
    if (!(await this.sessionService.revoke(id, { userId }))) {
      throw new NotFoundException();
    }
  }

  // Public so that a pending-MFA session can also be signed out.
  @Public()
  @StableHttpOperation('SessionsController', 'signOut', 'Sessions')
  @Post('sign-out')
  @HttpCode(204)
  async signOut(): Promise<void> {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException();
    }
  }

  @StableHttpOperation('SessionsController', 'signOutEverywhere', 'Sessions')
  @Post('sign-out-everywhere')
  @HttpCode(204)
  async signOutEverywhere(@CurrentUser('id') userId: string): Promise<void> {
    await this.signInService.signOutEverywhere(userId);
  }
}
