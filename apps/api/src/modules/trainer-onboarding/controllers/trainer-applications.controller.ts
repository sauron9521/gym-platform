import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '#src/common/rate-limit/rate-limit.policies';
import {
  nullable,
  trainerApplicationOwnResponseSchema,
} from '#src/infra/openapi/response-contracts';

import {
  trainerApplicationInputSchema,
  type TrainerApplicationInput,
} from '../dto/trainer-application.schemas.js';
import { TrainerApplicationsService } from '../services/trainer-applications.service.js';

type Actor = { id: string };

@ApiTags('Trainer applications')
@ApiBearerAuth('accessToken')
@ApiCookieAuth('sessionCookie')
@Controller('trainer-applications')
@Authenticate()
export class TrainerApplicationsController {
  constructor(private readonly service: TrainerApplicationsService) {}

  @Get('me')
  @RateLimit('read')
  @ApiOkResponse({ schema: nullable(trainerApplicationOwnResponseSchema) })
  findMine(@CurrentUser() user: Actor) {
    return this.service.findMine(user.id);
  }

  @Post()
  @RateLimit('auth')
  @ApiCreatedResponse({ schema: trainerApplicationOwnResponseSchema })
  submit(
    @CurrentUser() user: Actor,
    @Body({ schema: trainerApplicationInputSchema }) input: TrainerApplicationInput,
  ) {
    return this.service.submit(user.id, input);
  }

  @Patch('me')
  @RateLimit('auth')
  @ApiOkResponse({ schema: trainerApplicationOwnResponseSchema })
  updateMine(
    @CurrentUser() user: Actor,
    @Body({ schema: trainerApplicationInputSchema }) input: TrainerApplicationInput,
  ) {
    return this.service.updateMine(user.id, input);
  }
}
