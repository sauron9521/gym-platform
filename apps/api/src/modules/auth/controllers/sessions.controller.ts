import {
  CurrentSession,
  CurrentUser,
  Authenticate,
  SessionCookieProvider,
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
  UseGuards,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { AuthNoStoreInterceptor } from '../interceptors/auth-no-store.interceptor.js';
import { ApiCookieAuth, ApiOkResponse } from '@nestjs/swagger';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { adminSessionResponseSchema } from '#src/infra/openapi/response-contracts';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly signInService: SignInService,
  ) {}

  /** Only a live, explicitly elevated cookie can prove Admin Web access. */
  @Get('admin-session')
  @Authenticate({ providers: [SessionCookieProvider] })
  @UseGuards(AdminSessionPurposeGuard)
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ schema: adminSessionResponseSchema })
  adminSession(@CurrentUser('id') userId: string) {
    return { id: userId, role: 'ADMIN' as const };
  }

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
  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
    if (!(await this.sessionService.revoke(id, { userId }))) {
      throw new NotFoundException();
    }
  }

  // Public so that a pending-MFA session can also be signed out.
  @Public()
  @Post('sign-out')
  @HttpCode(204)
  async signOut(): Promise<void> {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException();
    }
  }

  @Post('sign-out-everywhere')
  @HttpCode(204)
  async signOutEverywhere(@CurrentUser('id') userId: string): Promise<void> {
    await this.signInService.signOutEverywhere(userId);
  }
}
