import { Authenticate, CurrentUser } from '@nestjs/authentication';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminCookieRoute } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import {
  arraySchema,
  trainerApplicationAdminResponseSchema,
} from '#src/infra/openapi/response-contracts';

import {
  trainerReviewApplicationIdSchema,
  trainerReviewDecisionSchema,
  type TrainerReviewDecision,
  TrainerReviewService,
  type Reviewer,
} from '#src/modules/trainer-onboarding/public-api';

@ApiTags('Trainer moderation')
@ApiCookieAuth('adminSessionCookie')
@Controller('admin/trainer-applications')
// Privileged moderation must authenticate a live browser session, never JWT alone.
// Only explicit admin-purpose sessions may perform privileged moderation.
@AdminCookieRoute()
@Authenticate({ providers: [AdminSessionCookieProvider] })
@UseGuards(AdminOriginGuard, AdminSessionPurposeGuard)
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
