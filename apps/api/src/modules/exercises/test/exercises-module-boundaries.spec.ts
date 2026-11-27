import { MODULE_METADATA } from '@nestjs/common/constants';
import { expectTypeOf } from 'vitest';
import { TrainerAthletesModule } from '#src/modules/trainer-athletes/trainer-athletes.module';
import { UsersModule } from '#src/modules/users/users.module';
import { ExercisesModule } from '../exercises.module.js';
import { ExercisesController } from '../controllers/exercises.controller.js';
import { ExerciseTrainerAccessController } from '../controllers/exercise-trainer-access.controller.js';
import { ExercisesRepository } from '../repositories/exercises.repository.js';
import { ExerciseTrainerAccessRepository } from '../repositories/exercise-trainer-access.repository.js';
import { ExercisesService } from '../services/exercises.service.js';
import { ExerciseTrainerAccessService } from '../services/exercise-trainer-access.service.js';
import { buildExerciseVisibilityWhere } from '../policies/exercise-access.policy.js';
import { workoutExerciseReferenceSelect } from '../selects/exercise.select.js';
import { exerciseIdSchema } from '../dto/exercise.schemas.js';
import { createExerciseSchema } from '../dto/create-exercise.dto.js';
import { updateExerciseSchema } from '../dto/update-exercise.dto.js';
import { queryExercisesSchema } from '../dto/query-exercises.dto.js';
import {
  exerciseTrainerAccessIdSchema,
  grantExerciseTrainerAccessSchema,
} from '../dto/exercise-trainer-access.dto.js';
import type { ExerciseActor, ExerciseAccessContext } from '../types/exercise.types.js';
import * as publicApi from '../public-api.js';

describe('ExercisesModule public boundary', () => {
  it('keeps both existing controller owners and exports only the two application services', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ExercisesModule)).toEqual([
      TrainerAthletesModule,
      UsersModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ExercisesModule)).toEqual([
      ExercisesController,
      ExerciseTrainerAccessController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ExercisesModule)).toEqual([
      ExercisesRepository,
      ExercisesService,
      ExerciseTrainerAccessRepository,
      ExerciseTrainerAccessService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, ExercisesModule)).toEqual([
      ExercisesService,
      ExerciseTrainerAccessService,
    ]);
  });

  it('preserves exact public identities including the transactional visibility predicate and projection', () => {
    const expected = {
      ExercisesService,
      ExerciseTrainerAccessService,
      buildExerciseVisibilityWhere,
      workoutExerciseReferenceSelect,
      exerciseIdSchema,
      createExerciseSchema,
      updateExerciseSchema,
      queryExercisesSchema,
      exerciseTrainerAccessIdSchema,
      grantExerciseTrainerAccessSchema,
    };
    expect(Object.keys(publicApi).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(publicApi[key]).toBe(expected[key]);
    }
    expectTypeOf<publicApi.ExerciseActor>().toEqualTypeOf<ExerciseActor>();
    expectTypeOf<publicApi.ExerciseAccessContext>().toEqualTypeOf<ExerciseAccessContext>();
  });

  it('preserves strict inputs without accepting a client-controlled owner or access context', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const body = {
      name: 'Bench press',
      muscleGroups: [{ slug: 'chest', role: 'PRIMARY' }],
      creationScope: 'ATHLETE',
    };
    expect(publicApi.createExerciseSchema.safeParse(body).success).toBe(true);
    expect(publicApi.createExerciseSchema.safeParse({ ...body, createdById: id }).success).toBe(
      false,
    );
    expect(
      publicApi.updateExerciseSchema.safeParse({ name: 'Bench press', createdById: id }).success,
    ).toBe(false);
    expect(publicApi.queryExercisesSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(publicApi.queryExercisesSchema.safeParse({ activeTrainerIds: [id] }).success).toBe(
      false,
    );
    expect(publicApi.grantExerciseTrainerAccessSchema.parse({ trainerId: id })).toEqual({
      trainerId: id,
    });
    expect(
      publicApi.grantExerciseTrainerAccessSchema.safeParse({ trainerId: id, athleteId: id })
        .success,
    ).toBe(false);
  });
});
