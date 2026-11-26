import { Controller, Get, Param } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  TrainerDashboardService,
  type TrainerAthleteActor,
  trainerAthleteIdSchema,
  trainerDashboardOverviewResponse,
  trainerClientProgressResponse,
} from '../public-api.js';

@ApiTags('Trainer Dashboard')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('trainer-dashboard')
@Authenticate()
export class TrainerDashboardController {
  constructor(private readonly dashboard: TrainerDashboardService) {}

  @Get('overview')
  @RateLimit('read')
  @ApiOkResponse({ schema: trainerDashboardOverviewResponse })
  overview(@CurrentUser() user: TrainerAthleteActor) {
    return this.dashboard.overview(user);
  }

  @Get('clients/:relationId/progress')
  @RateLimit('read')
  @ApiOkResponse({ schema: trainerClientProgressResponse })
  clientProgress(
    @CurrentUser() user: TrainerAthleteActor,
    @Param('relationId', { schema: trainerAthleteIdSchema }) relationId: string,
  ) {
    return this.dashboard.clientProgress(user, relationId);
  }
}
