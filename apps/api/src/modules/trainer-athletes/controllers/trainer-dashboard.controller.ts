import { Controller, Get, Param } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import { dateTimeSchema, integerSchema, objectSchema } from '#src/infra/openapi/response-contracts';

import { TrainerDashboardService } from '../services/trainer-dashboard.service.js';
import type { TrainerAthleteActor } from '../types/trainer-athlete.types.js';
import { trainerAthleteIdSchema } from '../dto/trainer-athlete.schemas.js';

const trainerDashboardOverviewResponse = objectSchema({
  asOf: dateTimeSchema,
  windowStart: dateTimeSchema,
  activeClients: integerSchema,
  activeProgramAssignments: integerSchema,
  completedProgramWorkouts30d: integerSchema,
});

const trainerClientProgressResponse = objectSchema({
  asOf: dateTimeSchema,
  windowStart: dateTimeSchema,
  activeProgramAssignments: integerSchema,
  completedProgramWorkouts30d: integerSchema,
});

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
