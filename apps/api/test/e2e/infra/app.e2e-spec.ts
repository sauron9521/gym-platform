import { Injectable, Module, type INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { AdminAuditLogger } from '../../../src/common/audit/admin-audit.logger.js';
import { AdminAuditModule } from '../../../src/common/audit/admin-audit.module.js';
import { DistributedThrottlerStorage } from '../../../src/common/rate-limit/distributed-throttler.storage.js';
import { RateLimitStorageModule } from '../../../src/common/rate-limit/rate-limit-storage.module.js';
import { PrismaModule } from '../../../src/infra/database/prisma.module.js';
import { PrismaService } from '../../../src/infra/database/prisma.service.js';
import { AuthModule } from '../../../src/modules/auth/auth.module.js';
import { CredentialsService } from '../../../src/modules/auth/services/credentials.service.js';
import { BodyMeasurementsModule } from '../../../src/modules/body-measurements/body-measurements.module.js';
import { BodyMeasurementsService } from '../../../src/modules/body-measurements/services/body-measurements.service.js';
import { ExercisesModule } from '../../../src/modules/exercises/exercises.module.js';
import { ExercisesService } from '../../../src/modules/exercises/services/exercises.service.js';
import { TrainerAthletesModule } from '../../../src/modules/trainer-athletes/trainer-athletes.module.js';
import { TrainerAthletesService } from '../../../src/modules/trainer-athletes/services/trainer-athletes.service.js';
import { TrainerOnboardingModule } from '../../../src/modules/trainer-onboarding/trainer-onboarding.module.js';
import {
  TrainerApplicationsService,
  TrainerReviewService,
} from '../../../src/modules/trainer-onboarding/public-api.js';
import { TrainerApplicationsRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-applications.repository.js';
import { TrainerReviewRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-review.repository.js';
import { TrainerApplicationsController } from '../../../src/modules/trainer-onboarding/controllers/trainer-applications.controller.js';
import { TrainerReviewController } from '../../../src/modules/trainer-onboarding/controllers/trainer-review.controller.js';
import { TrainingProgramsModule } from '../../../src/modules/training-programs/training-programs.module.js';
import { TrainingProgramsService } from '../../../src/modules/training-programs/services/training-programs.service.js';
import { UsersModule } from '../../../src/modules/users/users.module.js';
import { AccountDeletionRequestsModule } from '../../../src/modules/account-deletion-requests/account-deletion-requests.module.js';
import { AccountDeletionRequestsService } from '../../../src/modules/account-deletion-requests/services/account-deletion-requests.service.js';
import { UsersAuthFacade } from '../../../src/modules/users/services/users-auth.facade.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { WorkoutAnalyticsModule } from '../../../src/modules/workout-analytics/workout-analytics.module.js';
import { WorkoutAnalyticsService } from '../../../src/modules/workout-analytics/services/workout-analytics.service.js';
import { WorkoutsModule } from '../../../src/modules/workouts/workouts.module.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';

// Test-only consumer proves future adapter modules can resolve the existing
// services without redeclaring providers or exposing repositories.
@Injectable()
class TrainerOnboardingBoundaryProbe {
  constructor(
    readonly applications: TrainerApplicationsService,
    readonly review: TrainerReviewService,
  ) {}
}

@Module({ imports: [TrainerOnboardingModule], providers: [TrainerOnboardingBoundaryProbe] })
class TrainerOnboardingBoundaryProbeModule {}

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TrainerOnboardingBoundaryProbeModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should initialize the application', () => {
    expect(app).toBeDefined();
    expect(app.getHttpServer()).toBeDefined();
  });

  it('resolves real providers in feature module scopes', () => {
    // Select each declaring module, not the application-wide provider lookup.
    // This catches accidentally removed or moved Nest registrations.
    const scopes = [
      [AuthModule, CredentialsService],
      [UsersModule, UsersService],
      [UsersModule, UsersAuthFacade],
      [AccountDeletionRequestsModule, AccountDeletionRequestsService],
      [ExercisesModule, ExercisesService],
      [WorkoutsModule, WorkoutsService],
      [WorkoutAnalyticsModule, WorkoutAnalyticsService],
      [BodyMeasurementsModule, BodyMeasurementsService],
      [TrainerAthletesModule, TrainerAthletesService],
      [TrainerOnboardingModule, TrainerApplicationsService],
      [TrainingProgramsModule, TrainingProgramsService],
    ] as const;

    for (const [owner, provider] of scopes) {
      expect(app.select(owner).get(provider, { strict: true })).toBeInstanceOf(provider);
    }
  });

  it('resolves both onboarding contracts from an importing module without duplicate providers or controllers', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(TrainerOnboardingModule);
    const probe = app
      .select(TrainerOnboardingBoundaryProbeModule)
      .get(TrainerOnboardingBoundaryProbe, { strict: true });
    expect(modules.filter((module) => module.metatype === TrainerOnboardingModule)).toHaveLength(1);
    expect(probe.applications).toBe(core.get(TrainerApplicationsService, { strict: true }));
    expect(probe.review).toBe(core.get(TrainerReviewService, { strict: true }));
    for (const provider of [
      TrainerApplicationsService,
      TrainerReviewService,
      TrainerApplicationsRepository,
      TrainerReviewRepository,
    ]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([TrainerOnboardingModule]);
    }
    for (const controller of [TrainerApplicationsController, TrainerReviewController]) {
      expect(
        modules
          .filter((module) => module.controllers.has(controller))
          .map((module) => module.metatype),
      ).toEqual([TrainerOnboardingModule]);
    }
  });

  it('resolves the same Prisma singleton from the declaring module and app context', () => {
    const scoped = app.select(PrismaModule).get(PrismaService, { strict: true });
    // Prisma 7 returns a client proxy: instanceof PrismaService is not reliable.
    expect(Object.is(scoped, app.get(PrismaService))).toBe(true);
    expect(typeof scoped.$transaction).toBe('function');
  });

  it.each([
    [
      'RateLimitStorageModule / DistributedThrottlerStorage',
      RateLimitStorageModule,
      DistributedThrottlerStorage,
    ],
    ['AdminAuditModule / AdminAuditLogger', AdminAuditModule, AdminAuditLogger],
  ] as const)('resolves %s from its declaring infrastructure module', (_name, owner, provider) => {
    const instance = app.select(owner).get(provider, { strict: true });
    expect(instance instanceof provider).toBe(true);
  });

  it('resolves global ConfigService without reading secrets', () => {
    expect(app.get(ConfigService) instanceof ConfigService).toBe(true);
  });
});
