import type { INestApplication } from '@nestjs/common';
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
import { TrainerApplicationsService } from '../../../src/modules/trainer-onboarding/services/trainer-applications.service.js';
import { TrainingProgramsModule } from '../../../src/modules/training-programs/training-programs.module.js';
import { TrainingProgramsService } from '../../../src/modules/training-programs/services/training-programs.service.js';
import { UsersModule } from '../../../src/modules/users/users.module.js';
import { UsersAuthFacade } from '../../../src/modules/users/services/users-auth.facade.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { WorkoutAnalyticsModule } from '../../../src/modules/workout-analytics/workout-analytics.module.js';
import { WorkoutAnalyticsService } from '../../../src/modules/workout-analytics/services/workout-analytics.service.js';
import { WorkoutsModule } from '../../../src/modules/workouts/workouts.module.js';
import { WorkoutsService } from '../../../src/modules/workouts/services/workouts.service.js';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

  it('resolves real providers in all nine feature module scopes', () => {
    // Select each declaring module, not the application-wide provider lookup.
    // This catches accidentally removed or moved Nest registrations.
    const scopes = [
      [AuthModule, CredentialsService],
      [UsersModule, UsersService],
      [UsersModule, UsersAuthFacade],
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

  it.each([
    ['PrismaModule / PrismaService', PrismaModule, PrismaService],
    ['RateLimitStorageModule / DistributedThrottlerStorage', RateLimitStorageModule, DistributedThrottlerStorage],
    ['AdminAuditModule / AdminAuditLogger', AdminAuditModule, AdminAuditLogger],
  ] as const)('resolves %s from its declaring infrastructure module', (_name, owner, provider) => {
    const instance = app.select(owner).get(provider, { strict: true });
    // Boolean assertion avoids recursive inspection of PrismaClient proxies.
    expect(instance instanceof provider).toBe(true);
  });

  it('resolves global ConfigService without reading secrets', () => {
    expect(app.get(ConfigService) instanceof ConfigService).toBe(true);
  });
});
