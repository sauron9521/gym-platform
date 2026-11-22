import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { SessionAuth } from '#src/modules/auth/providers/session-auth.provider';
import {
  arraySchema,
  trainerApplicationAdminResponseSchema,
} from '#src/infra/openapi/response-contracts';

import {
  trainerReviewApplicationIdSchema,
  trainerReviewDecisionSchema,
  type TrainerReviewDecision,
} from '../dto/trainer-review.schemas.js';
import { TrainerReviewService, type Reviewer } from '../services/trainer-review.service.js';

@ApiTags('Trainer moderation')
@ApiCookieAuth('sessionCookie')
@Controller('admin/trainer-applications')
// Privileged moderation must authenticate a live browser session, never JWT alone.
// Dedicated admin-purpose sessions and step-up remain separate security work.
@Authenticate({ providers: [SessionAuth] })
export class TrainerReviewController {
  constructor(private readonly service: TrainerReviewService) {}

  @Get()
  @RateLimit('read')
  @ApiOkResponse({ schema: arraySchema(trainerApplicationAdminResponseSchema) })
  findPending(@CurrentUser() reviewer: Reviewer) {
    return this.service.findPending(reviewer);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RateLimit('auth')
  @ApiOkResponse({ schema: trainerApplicationAdminResponseSchema })
  approve(
    @Param('id', { schema: trainerReviewApplicationIdSchema }) id: string,
    @CurrentUser() reviewer: Reviewer,
    @Body({ schema: trainerReviewDecisionSchema }) body: TrainerReviewDecision,
  ) {
    return this.service.decide(id, reviewer, 'APPROVE', body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RateLimit('auth')
  @ApiOkResponse({ schema: trainerApplicationAdminResponseSchema })
  reject(
    @Param('id', { schema: trainerReviewApplicationIdSchema }) id: string,
    @CurrentUser() reviewer: Reviewer,
    @Body({ schema: trainerReviewDecisionSchema }) body: TrainerReviewDecision,
  ) {
    return this.service.decide(id, reviewer, 'REJECT', body);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @RateLimit('auth')
  @ApiOkResponse({ schema: trainerApplicationAdminResponseSchema })
  revoke(
    @Param('id', { schema: trainerReviewApplicationIdSchema }) id: string,
    @CurrentUser() reviewer: Reviewer,
    @Body({ schema: trainerReviewDecisionSchema }) body: TrainerReviewDecision,
  ) {
    return this.service.decide(id, reviewer, 'REVOKE', body);
  }
}
