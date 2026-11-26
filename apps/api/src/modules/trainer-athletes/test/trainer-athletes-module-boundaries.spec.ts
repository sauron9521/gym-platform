import { MODULE_METADATA } from '@nestjs/common/constants';
import { expectTypeOf } from 'vitest';
import { UsersModule } from '#src/modules/users/users.module';
import type { ExerciseAccessContext } from '#src/modules/exercises/public-api';
import { TrainerAthletesModule } from '../trainer-athletes.module.js';
import * as publicApi from '../public-api.js';
import { TrainerAthletesRepository } from '../repositories/trainer-athletes.repository.js';
import { TrainerDashboardRepository } from '../repositories/trainer-dashboard.repository.js';
import { TrainerAthleteTerminationService } from '../services/trainer-athlete-termination.service.js';
import { TrainerAthleteExerciseCopyService } from '../services/trainer-athlete-exercise-copy.service.js';
import { TrainerAthletesService } from '../services/trainer-athletes.service.js';
import { TrainerDashboardService } from '../services/trainer-dashboard.service.js';
import type { TrainerAthleteActor } from '../types/trainer-athlete.types.js';
import { trainerAthleteIdSchema } from '../dto/trainer-athlete.schemas.js';
import { createTrainerAthleteSchema } from '../dto/create-trainer-athlete.dto.js';
import { queryTrainerAthletesSchema } from '../dto/query-trainer-athletes.dto.js';
import { terminateTrainerAthleteSchema } from '../dto/terminate-trainer-athlete.dto.js';
import {
  trainerDashboardOverviewResponse,
  trainerClientProgressResponse,
} from '../trainer-dashboard.responses.js';

describe('TrainerAthletesModule public boundary', () => {
  it('exports only the two application services and preserves private transactional providers', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, TrainerAthletesModule)).toEqual([
      UsersModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TrainerAthletesModule)).toEqual([
      TrainerAthletesRepository,
      TrainerAthletesService,
      TrainerAthleteTerminationService,
      TrainerAthleteExerciseCopyService,
      TrainerDashboardRepository,
      TrainerDashboardService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, TrainerAthletesModule)).toEqual([
      TrainerAthletesService,
      TrainerDashboardService,
    ]);
  });

  it('exports exactly the existing service and schema identities', () => {
    const expected = {
      TrainerAthletesService,
      TrainerDashboardService,
      trainerAthleteIdSchema,
      createTrainerAthleteSchema,
      queryTrainerAthletesSchema,
      terminateTrainerAthleteSchema,
      trainerDashboardOverviewResponse,
      trainerClientProgressResponse,
    };
    expect(Object.keys(publicApi).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(publicApi[key]).toBe(expected[key]);
    }
    expectTypeOf<publicApi.TrainerAthleteActor>().toEqualTypeOf<TrainerAthleteActor>();
    expectTypeOf<
      Awaited<ReturnType<TrainerAthletesService['getExerciseAccessContext']>>
    >().toEqualTypeOf<ExerciseAccessContext>();
  });

  it('keeps authenticated actor identity separate from the invitation target and other client inputs', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    expect(publicApi.createTrainerAthleteSchema.parse({ userId })).toEqual({ userId });
    expect(
      publicApi.createTrainerAthleteSchema.safeParse({ userId, trainerId: userId }).success,
    ).toBe(false);
    expect(
      publicApi.createTrainerAthleteSchema.safeParse({ userId, initiatedById: userId }).success,
    ).toBe(false);
    expect(publicApi.queryTrainerAthletesSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(publicApi.queryTrainerAthletesSchema.safeParse({ athleteId: userId }).success).toBe(
      false,
    );
    expect(publicApi.terminateTrainerAthleteSchema.safeParse({ endedById: userId }).success).toBe(
      false,
    );
  });
});
