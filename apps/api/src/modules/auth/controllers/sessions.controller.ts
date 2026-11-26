import {
  CurrentSession,
  CurrentUser,
  Authenticate,
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
  Req,
  Res,
} from '@nestjs/common';
import { AuthNoStoreInterceptor } from '../interceptors/auth-no-store.interceptor.js';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminCookieRoute } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';
import type { Request, Response } from 'express';
import { PrismaSessionStore } from '../stores/prisma-session.store.js';
import { adminSessionResponseSchema } from '#src/infra/openapi/response-contracts';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly signInService: SignInService,
    private readonly prismaSessionStore: PrismaSessionStore,
    private readonly adminCookies: AdminCookieAuthService,
  ) {}

  /** Only a live, explicitly elevated cookie can prove Admin Web access. */
  @StableHttpOperation('SessionsController', 'adminSession', 'Sessions')
  @Get('admin-session')
  @AdminCookieRoute()
  @Authenticate({ providers: [AdminSessionCookieProvider] })
  @UseGuards(AdminOriginGuard, AdminSessionPurposeGuard)
  @ApiCookieAuth('adminSessionCookie')
  @ApiOkResponse({ schema: adminSessionResponseSchema })
  adminSession(@CurrentUser('id') userId: string) {
    return { id: userId, role: 'ADMIN' as const };
  }

  /**
   * Revoke only this principal's admin-purpose sessions across all browsers.
   * The endpoint MUST authenticate via an admin-purpose cookie, not JWT or an
   * ordinary ADMIN login. No refresh token or regular session is revoked.
   */
  @StableHttpOperation('SessionsController', 'revokeAdminSessions', 'Sessions')
  @Post('admin-sessions/revoke-all')
  @HttpCode(204)
  @AdminCookieRoute()
  @Authenticate({ providers: [AdminSessionCookieProvider] })
  @UseGuards(AdminOriginGuard, AdminSessionPurposeGuard)
  @ApiCookieAuth('adminSessionCookie')
  @ApiNoContentResponse()
  async revokeAdminSessions(
    @CurrentUser('id') userId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.prismaSessionStore.revokeAdminSessionsForUser(userId);
    // Already revoked: signOut() still clears this browser's cookie, even
    // when it returns false for an absent server session.
    await this.adminCookies.signOut(request, response);
  }

  /** Public to let a pending MFA admin session be cleared safely. */
  @Public()
  @StableHttpOperation('SessionsController', 'adminSignOut', 'Sessions')
  @Post('admin-sign-out')
  @HttpCode(204)
  @UseGuards(AdminOriginGuard)
  @ApiNoContentResponse()
  async adminSignOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!(await this.adminCookies.signOut(request, response))) {
      throw new UnauthorizedException();
    }
  }

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
