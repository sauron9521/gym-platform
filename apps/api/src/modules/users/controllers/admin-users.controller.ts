import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AdminAuditLogger } from '#src/common/audit/admin-audit.logger';
import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { AdminUsersReadGuard } from './admin-users-read.guard.js';
import { adminUserListResponseSchema } from '#src/infra/openapi/response-contracts';

import { type AdminUsersQuery, adminUsersQuerySchema } from '../dto/admin-users-query.dto.js';
import { UsersRepository } from '../repositories/users.repository.js';

type Actor = { id: string };

@ApiTags('Admin users')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('admin/users')
@Authenticate()
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
}
