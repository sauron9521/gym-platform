import { Authenticate, CurrentUser, SessionCookieProvider } from '@nestjs/authentication';
import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';

import { AdminAuditLogger } from '#src/common/audit/admin-audit.logger';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { AdminUsersReadGuard } from './admin-users-read.guard.js';
import {
  adminUserDetailResponseSchema,
  adminUserListResponseSchema,
} from '#src/infra/openapi/response-contracts';

import { type AdminUsersQuery, adminUsersQuerySchema } from '../dto/admin-users-query.dto.js';
import { UsersRepository } from '../repositories/users.repository.js';

type Actor = { id: string };

@ApiTags('Admin users')
@ApiCookieAuth('sessionCookie')
@Controller('admin/users')
// Restrict privileged reads to live server-side cookies, not bearer JWTs.
// Dedicated admin-purpose sessions and step-up remain #289/#290 follow-ups.
@Authenticate({ providers: [SessionCookieProvider] })
export class AdminUsersController {
  constructor(
    private readonly users: UsersRepository,
    private readonly audit: AdminAuditLogger,
  ) {}

  /** Read-only and operator-scoped; does not grant account mutation permissions. */
  @Get()
  @UseGuards(AdminUsersReadGuard)
  @RateLimit('read')
  @ApiOkResponse({ schema: adminUserListResponseSchema })
  async list(
    @Query({ schema: adminUsersQuerySchema }) query: AdminUsersQuery,
    @CurrentUser() actor: Actor,
    @Req() request: Request,
  ) {
    const result = await this.users.listForAdmin(query);
    this.audit.record(
      { permission: 'admin.accounts.read', actorId: actor.id, outcome: 'allowed' },
      request,
    );
    return result;
  }

  /** Never return soft-deleted users or return a profile's sensitive details. */
  @Get(':userId')
  @UseGuards(AdminUsersReadGuard)
  @RateLimit('read')
  @ApiOkResponse({ schema: adminUserDetailResponseSchema })
  @ApiNotFoundResponse({ description: 'Account not found or has been deleted.' })
  async detail(
    @Param('userId', { schema: z.uuid() }) userId: string,
    @CurrentUser() actor: Actor,
    @Req() request: Request,
  ) {
    const user = await this.users.findForAdminDetails(userId);
    if (!user) throw new NotFoundException('User not found');
    this.audit.record(
      { permission: 'admin.accounts.read', actorId: actor.id, outcome: 'allowed' },
      request,
    );
    return user;
  }
}
