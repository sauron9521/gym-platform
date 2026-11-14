import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { exerciseTaxonomyListResponseSchema } from '#src/infra/openapi/response-contracts';
import { ExerciseTaxonomyService } from '../services/exercise-taxonomy.service.js';

@ApiTags('Exercise Taxonomy')
@Controller('exercise-taxonomy')
export class ExerciseTaxonomyController {
  constructor(private readonly service: ExerciseTaxonomyService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('muscle-groups')
  @ApiOkResponse({ schema: exerciseTaxonomyListResponseSchema })
  findMuscleGroups() {
    return this.service.findMuscleGroups();
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('equipment')
  @ApiOkResponse({ schema: exerciseTaxonomyListResponseSchema })
  findEquipment() {
    return this.service.findEquipment();
  }
}
