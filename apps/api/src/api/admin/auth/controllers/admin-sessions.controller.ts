import { CurrentUser, Authenticate, Public } from '@nestjs/authentication';
import {
  Controller,
  Get,
  HttpCode,
  UseGuards,
  Post,
  UnauthorizedException,
  UseInterceptors,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthNoStoreInterceptor, AdminSessionFacade } from '#src/modules/auth/public-api';
import { StableHttpOperation } from '#src/common/http/stable-http-operation.decorator';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminCookieRoute } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { adminSessionResponseSchema } from '#src/infra/openapi/response-contracts';

@UseInterceptors(AuthNoStoreInterceptor)
@Controller('auth')
export class AdminSessionsController {
  constructor(private readonly adminSessions: AdminSessionFacade) {}

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
    await this.adminSessions.revokeAll(userId, request, response);
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
    if (!(await this.adminSessions.signOut(request, response))) {
      throw new UnauthorizedException();
    }
  }
}
