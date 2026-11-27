import { Injectable, Module, type INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { NotificationsModule } from '../../../src/modules/notifications/notifications.module.js';
import {
  NotificationInboxService,
  NotificationSettingsService,
} from '../../../src/modules/notifications/public-api.js';
import { OutboxDispatchRepository } from '../../../src/modules/notifications/repositories/outbox-dispatch.repository.js';
import { OutboxDispatchService } from '../../../src/modules/notifications/services/outbox-dispatch.service.js';
import { NotificationDeliveryRepository } from '../../../src/modules/notifications/repositories/notification-delivery.repository.js';
import { NotificationInboxRepository } from '../../../src/modules/notifications/repositories/notification-inbox.repository.js';
import { NotificationInboxController } from '../../../src/api/shared/notifications/controllers/notification-inbox.controller.js';
import { NotificationSettingsRepository } from '../../../src/modules/notifications/repositories/notification-settings.repository.js';
import { NotificationSettingsController } from '../../../src/api/shared/notifications/controllers/notification-settings.controller.js';
import { SharedNotificationsApiModule } from '../../../src/api/shared/notifications/shared-notifications-api.module.js';
import { AdminAuditLogger } from '../../../src/common/audit/admin-audit.logger.js';
import { AdminAuditModule } from '../../../src/common/audit/admin-audit.module.js';
import { DistributedThrottlerStorage } from '../../../src/common/rate-limit/distributed-throttler.storage.js';
import { RateLimitStorageModule } from '../../../src/common/rate-limit/rate-limit-storage.module.js';
import { PrismaModule } from '../../../src/infra/database/prisma.module.js';
import { PrismaService } from '../../../src/infra/database/prisma.service.js';
import { AuthModule } from '../../../src/modules/auth/auth.module.js';
import { CredentialsService } from '../../../src/modules/auth/services/credentials.service.js';
import { BodyMeasurementsModule } from '../../../src/modules/body-measurements/body-measurements.module.js';
import {
  BodyMeasurementsService,
  BodyMeasurementStatisticsService,
} from '../../../src/modules/body-measurements/public-api.js';
import { BodyMeasurementsRepository } from '../../../src/modules/body-measurements/repositories/body-measurements.repository.js';
import { BodyMeasurementStatisticsRepository } from '../../../src/modules/body-measurements/repositories/body-measurement-statistics.repository.js';
import { BodyMeasurementsController } from '../../../src/api/athlete/body-measurements/controllers/body-measurements.controller.js';
import { AthleteBodyMeasurementsApiModule } from '../../../src/api/athlete/body-measurements/athlete-body-measurements-api.module.js';
import { AthleteApiModule } from '../../../src/api/athlete/athlete-api.module.js';
import { ExercisesModule } from '../../../src/modules/exercises/exercises.module.js';
import { ExercisesService } from '../../../src/modules/exercises/services/exercises.service.js';
import { TrainerAthletesModule } from '../../../src/modules/trainer-athletes/trainer-athletes.module.js';
import {
  TrainerAthletesService,
  TrainerDashboardService,
} from '../../../src/modules/trainer-athletes/public-api.js';
import { TrainerAthletesRepository } from '../../../src/modules/trainer-athletes/repositories/trainer-athletes.repository.js';
import { TrainerDashboardRepository } from '../../../src/modules/trainer-athletes/repositories/trainer-dashboard.repository.js';
import { TrainerAthleteTerminationService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-termination.service.js';
import { TrainerAthleteExerciseCopyService } from '../../../src/modules/trainer-athletes/services/trainer-athlete-exercise-copy.service.js';
import { TrainerAthletesController } from '../../../src/api/shared/trainer-athletes/controllers/trainer-athletes.controller.js';
import { SharedTrainerAthletesApiModule } from '../../../src/api/shared/trainer-athletes/shared-trainer-athletes-api.module.js';
import { TrainerDashboardController } from '../../../src/api/trainer/trainer-athletes/controllers/trainer-dashboard.controller.js';
import { TrainerApiModule } from '../../../src/api/trainer/trainer-api.module.js';
import { TrainerTrainerAthletesApiModule } from '../../../src/api/trainer/trainer-athletes/trainer-trainer-athletes-api.module.js';
import { TrainerOnboardingModule } from '../../../src/modules/trainer-onboarding/trainer-onboarding.module.js';
import {
  TrainerApplicationsService,
  TrainerReviewService,
} from '../../../src/modules/trainer-onboarding/public-api.js';
import { TrainerApplicationsRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-applications.repository.js';
import { TrainerReviewRepository } from '../../../src/modules/trainer-onboarding/repositories/trainer-review.repository.js';
import { TrainerApplicationsController } from '../../../src/api/shared/trainer-onboarding/controllers/trainer-applications.controller.js';
import { SharedTrainerOnboardingApiModule } from '../../../src/api/shared/trainer-onboarding/shared-trainer-onboarding-api.module.js';
import { TrainerReviewController } from '../../../src/api/admin/trainer-onboarding/controllers/trainer-review.controller.js';
import { AdminTrainerOnboardingApiModule } from '../../../src/api/admin/trainer-onboarding/admin-trainer-onboarding-api.module.js';
import { AdminOriginGuard } from '../../../src/common/auth/admin-origin.guard.js';
import { AdminSessionPurposeGuard } from '../../../src/common/auth/admin-session-purpose.guard.js';
import { TrainingProgramsModule } from '../../../src/modules/training-programs/training-programs.module.js';
import { TrainingProgramsService } from '../../../src/modules/training-programs/services/training-programs.service.js';
import { UsersModule } from '../../../src/modules/users/users.module.js';
import { AccountDeletionRequestsModule } from '../../../src/modules/account-deletion-requests/account-deletion-requests.module.js';
import { AccountDeletionRequestsService } from '../../../src/modules/account-deletion-requests/public-api.js';
import { AccountDeletionRequestsRepository } from '../../../src/modules/account-deletion-requests/repositories/account-deletion-requests.repository.js';
import { AccountDeletionRequestsController } from '../../../src/api/shared/account-deletion-requests/controllers/account-deletion-requests.controller.js';
import { SharedAccountDeletionRequestsApiModule } from '../../../src/api/shared/account-deletion-requests/shared-account-deletion-requests-api.module.js';
import { UsersAuthFacade } from '../../../src/modules/users/services/users-auth.facade.js';
import { UsersService } from '../../../src/modules/users/services/users.service.js';
import { WorkoutAnalyticsModule } from '../../../src/modules/workout-analytics/workout-analytics.module.js';
import { WorkoutAnalyticsService } from '../../../src/modules/workout-analytics/public-api.js';
import { WorkoutAnalyticsRepository } from '../../../src/modules/workout-analytics/repositories/workout-analytics.repository.js';
import { WorkoutAnalyticsController } from '../../../src/api/athlete/workout-analytics/controllers/workout-analytics.controller.js';
import { AthleteWorkoutAnalyticsApiModule } from '../../../src/api/athlete/workout-analytics/athlete-workout-analytics-api.module.js';
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

@Injectable()
class NotificationsBoundaryProbe {
  constructor(
    readonly settings: NotificationSettingsService,
    readonly inbox: NotificationInboxService,
  ) {}
}

@Module({ imports: [NotificationsModule], providers: [NotificationsBoundaryProbe] })
class NotificationsBoundaryProbeModule {}

@Injectable()
class AccountDeletionRequestsBoundaryProbe {
  constructor(readonly requests: AccountDeletionRequestsService) {}
}

@Module({
  imports: [AccountDeletionRequestsModule],
  providers: [AccountDeletionRequestsBoundaryProbe],
})
class AccountDeletionRequestsBoundaryProbeModule {}

@Injectable()
class BodyMeasurementsBoundaryProbe {
  constructor(
    readonly measurements: BodyMeasurementsService,
    readonly statistics: BodyMeasurementStatisticsService,
  ) {}
}

@Module({ imports: [BodyMeasurementsModule], providers: [BodyMeasurementsBoundaryProbe] })
class BodyMeasurementsBoundaryProbeModule {}

@Injectable()
class WorkoutAnalyticsBoundaryProbe {
  constructor(readonly analytics: WorkoutAnalyticsService) {}
}

@Module({ imports: [WorkoutAnalyticsModule], providers: [WorkoutAnalyticsBoundaryProbe] })
class WorkoutAnalyticsBoundaryProbeModule {}

@Injectable()
class TrainerAthletesBoundaryProbe {
  constructor(
    readonly relationships: TrainerAthletesService,
    readonly dashboard: TrainerDashboardService,
  ) {}
}

@Module({ imports: [TrainerAthletesModule], providers: [TrainerAthletesBoundaryProbe] })
class TrainerAthletesBoundaryProbeModule {}

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TrainerOnboardingBoundaryProbeModule,
        NotificationsBoundaryProbeModule,
        AccountDeletionRequestsBoundaryProbeModule,
        BodyMeasurementsBoundaryProbeModule,
        WorkoutAnalyticsBoundaryProbeModule,
        TrainerAthletesBoundaryProbeModule,
      ],
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
    expect(
      modules.find((module) => module.metatype === TrainerOnboardingModule)?.controllers.size,
    ).toBe(0);
    expect(
      app
        .select(SharedTrainerOnboardingApiModule)
        .get(TrainerApplicationsController, { strict: true }),
    ).toBeInstanceOf(TrainerApplicationsController);
    expect(
      modules.find((module) => module.metatype === SharedTrainerOnboardingApiModule)?.controllers
        .size,
    ).toBe(1);
    expect(
      modules.find((module) => module.metatype === AdminTrainerOnboardingApiModule)?.controllers
        .size,
    ).toBe(1);
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
    for (const [controller, owner] of [
      [TrainerApplicationsController, SharedTrainerOnboardingApiModule],
      [TrainerReviewController, AdminTrainerOnboardingApiModule],
    ] as const) {
      expect(
        modules
          .filter((module) => module.controllers.has(controller))
          .map((module) => module.metatype),
      ).toEqual([owner]);
    }
  });

  it('resolves moved review controller and guards from the Admin leaf without redundant core registration', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = modules.find((module) => module.metatype === TrainerOnboardingModule);
    const admin = modules.find((module) => module.metatype === AdminTrainerOnboardingApiModule);
    expect(
      app.select(AdminTrainerOnboardingApiModule).get(TrainerReviewController, { strict: true }),
    ).toBeInstanceOf(TrainerReviewController);
    for (const guard of [AdminOriginGuard, AdminSessionPurposeGuard]) {
      expect(core?.providers.has(guard)).toBe(false);
      expect(core?.injectables.has(guard)).toBe(false);
      expect(admin?.injectables.has(guard)).toBe(true);
    }
    expect(
      modules
        .filter((module) => module.providers.has(AdminAuditLogger))
        .map((module) => module.metatype),
    ).toEqual([AdminAuditModule]);
  });

  it('resolves notification settings and inbox from an importing module without duplicating providers or routes', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(NotificationsModule);
    const probe = app
      .select(NotificationsBoundaryProbeModule)
      .get(NotificationsBoundaryProbe, { strict: true });
    expect(modules.filter((module) => module.metatype === NotificationsModule)).toHaveLength(1);
    expect(probe.settings).toBe(core.get(NotificationSettingsService, { strict: true }));
    expect(probe.inbox).toBe(core.get(NotificationInboxService, { strict: true }));
    expect(
      modules.find((module) => module.metatype === NotificationsModule)?.controllers.size,
    ).toBe(0);
    expect(
      modules.filter((module) => module.metatype === SharedNotificationsApiModule),
    ).toHaveLength(1);
    const shared = modules.find((module) => module.metatype === SharedNotificationsApiModule);
    expect([...shared!.controllers.keys()]).toEqual([
      NotificationSettingsController,
      NotificationInboxController,
    ]);
    for (const controller of [NotificationSettingsController, NotificationInboxController]) {
      expect(
        app.select(SharedNotificationsApiModule).get(controller, { strict: true }),
      ).toBeInstanceOf(controller);
      expect(
        modules
          .filter((module) => module.controllers.has(controller))
          .map((module) => module.metatype),
      ).toEqual([SharedNotificationsApiModule]);
    }
    for (const provider of [
      NotificationSettingsService,
      NotificationSettingsRepository,
      NotificationInboxService,
      NotificationInboxRepository,
      OutboxDispatchRepository,
      OutboxDispatchService,
      NotificationDeliveryRepository,
    ]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([NotificationsModule]);
    }
  });

  it('resolves account deletion intake from an importing module with unique service, repository, quota and controller ownership', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(AccountDeletionRequestsModule);
    const probe = app
      .select(AccountDeletionRequestsBoundaryProbeModule)
      .get(AccountDeletionRequestsBoundaryProbe, { strict: true });
    expect(
      modules.filter((module) => module.metatype === AccountDeletionRequestsModule),
    ).toHaveLength(1);
    expect(probe.requests).toBe(core.get(AccountDeletionRequestsService, { strict: true }));
    expect(
      modules.find((module) => module.metatype === AccountDeletionRequestsModule)?.controllers.size,
    ).toBe(0);
    expect(
      modules.filter((module) => module.metatype === SharedAccountDeletionRequestsApiModule),
    ).toHaveLength(1);
    expect(
      modules.find((module) => module.metatype === SharedAccountDeletionRequestsApiModule)
        ?.controllers.size,
    ).toBe(1);
    expect(
      app
        .select(SharedAccountDeletionRequestsApiModule)
        .get(AccountDeletionRequestsController, { strict: true }),
    ).toBeInstanceOf(AccountDeletionRequestsController);
    for (const provider of [AccountDeletionRequestsService, AccountDeletionRequestsRepository]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([AccountDeletionRequestsModule]);
    }
    expect(
      modules
        .filter((module) => module.providers.has(DistributedThrottlerStorage))
        .map((module) => module.metatype),
    ).toEqual([RateLimitStorageModule]);
    expect(
      modules
        .filter((module) => module.controllers.has(AccountDeletionRequestsController))
        .map((module) => module.metatype),
    ).toEqual([SharedAccountDeletionRequestsApiModule]);
  });

  it('resolves both measurement contracts from an importing module without duplicating providers or controllers', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(BodyMeasurementsModule);
    const probe = app
      .select(BodyMeasurementsBoundaryProbeModule)
      .get(BodyMeasurementsBoundaryProbe, { strict: true });
    expect(modules.filter((module) => module.metatype === BodyMeasurementsModule)).toHaveLength(1);
    expect(probe.measurements).toBe(core.get(BodyMeasurementsService, { strict: true }));
    expect(probe.statistics).toBe(core.get(BodyMeasurementStatisticsService, { strict: true }));
    expect(
      modules.find((module) => module.metatype === BodyMeasurementsModule)?.controllers.size,
    ).toBe(0);
    expect(modules.filter((module) => module.metatype === AthleteApiModule)).toHaveLength(1);
    expect(
      modules.filter((module) => module.metatype === AthleteBodyMeasurementsApiModule),
    ).toHaveLength(1);
    expect(
      modules.find((module) => module.metatype === AthleteBodyMeasurementsApiModule)?.controllers
        .size,
    ).toBe(1);
    expect(
      app
        .select(AthleteBodyMeasurementsApiModule)
        .get(BodyMeasurementsController, { strict: true }),
    ).toBeInstanceOf(BodyMeasurementsController);
    for (const provider of [
      BodyMeasurementsService,
      BodyMeasurementStatisticsService,
      BodyMeasurementsRepository,
      BodyMeasurementStatisticsRepository,
    ]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([BodyMeasurementsModule]);
    }
    expect(
      modules
        .filter((module) => module.controllers.has(BodyMeasurementsController))
        .map((module) => module.metatype),
    ).toEqual([AthleteBodyMeasurementsApiModule]);
  });

  it('resolves the analytics contract from an importing module without duplicate providers or controllers', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(WorkoutAnalyticsModule);
    const probe = app
      .select(WorkoutAnalyticsBoundaryProbeModule)
      .get(WorkoutAnalyticsBoundaryProbe, { strict: true });
    expect(modules.filter((module) => module.metatype === WorkoutAnalyticsModule)).toHaveLength(1);
    expect(probe.analytics).toBe(core.get(WorkoutAnalyticsService, { strict: true }));
    expect(
      modules.find((module) => module.metatype === WorkoutAnalyticsModule)?.controllers.size,
    ).toBe(0);
    expect(modules.filter((module) => module.metatype === AthleteApiModule)).toHaveLength(1);
    expect(
      modules.filter((module) => module.metatype === AthleteWorkoutAnalyticsApiModule),
    ).toHaveLength(1);
    expect(
      modules.find((module) => module.metatype === AthleteWorkoutAnalyticsApiModule)?.controllers
        .size,
    ).toBe(1);
    expect(
      app
        .select(AthleteWorkoutAnalyticsApiModule)
        .get(WorkoutAnalyticsController, { strict: true }),
    ).toBeInstanceOf(WorkoutAnalyticsController);
    for (const provider of [WorkoutAnalyticsService, WorkoutAnalyticsRepository]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([WorkoutAnalyticsModule]);
    }
    expect(
      modules
        .filter((module) => module.providers.has(UsersService))
        .map((module) => module.metatype),
    ).toEqual([UsersModule]);
    expect(
      modules
        .filter((module) => module.controllers.has(WorkoutAnalyticsController))
        .map((module) => module.metatype),
    ).toEqual([AthleteWorkoutAnalyticsApiModule]);
  });

  it('resolves both relationship and dashboard contracts without duplicating transactional providers or controllers', () => {
    const modules = [...app.get(ModulesContainer).values()];
    const core = app.select(TrainerAthletesModule);
    const probe = app
      .select(TrainerAthletesBoundaryProbeModule)
      .get(TrainerAthletesBoundaryProbe, { strict: true });
    expect(modules.filter((module) => module.metatype === TrainerAthletesModule)).toHaveLength(1);
    expect(probe.relationships).toBe(core.get(TrainerAthletesService, { strict: true }));
    expect(probe.dashboard).toBe(core.get(TrainerDashboardService, { strict: true }));
    for (const provider of [
      TrainerAthletesService,
      TrainerDashboardService,
      TrainerAthletesRepository,
      TrainerDashboardRepository,
      TrainerAthleteTerminationService,
      TrainerAthleteExerciseCopyService,
    ]) {
      expect(
        modules.filter((module) => module.providers.has(provider)).map((module) => module.metatype),
      ).toEqual([TrainerAthletesModule]);
    }
    expect(
      modules
        .filter((module) => module.providers.has(UsersService))
        .map((module) => module.metatype),
    ).toEqual([UsersModule]);
    expect(
      modules.filter((module) => module.metatype === SharedTrainerAthletesApiModule),
    ).toHaveLength(1);
    expect(
      modules.find((module) => module.metatype === SharedTrainerAthletesApiModule)?.controllers
        .size,
    ).toBe(1);
    expect(
      modules.find((module) => module.metatype === TrainerAthletesModule)?.controllers.size,
    ).toBe(0);
    expect(modules.filter((module) => module.metatype === TrainerApiModule)).toHaveLength(1);
    expect(
      modules.filter((module) => module.metatype === TrainerTrainerAthletesApiModule),
    ).toHaveLength(1);
    expect(
      modules.find((module) => module.metatype === TrainerTrainerAthletesApiModule)?.controllers
        .size,
    ).toBe(1);
    expect(
      app.select(SharedTrainerAthletesApiModule).get(TrainerAthletesController, { strict: true }),
    ).toBeInstanceOf(TrainerAthletesController);
    expect(
      app.select(TrainerTrainerAthletesApiModule).get(TrainerDashboardController, { strict: true }),
    ).toBeInstanceOf(TrainerDashboardController);
    expect(
      modules
        .filter((module) => module.controllers.has(TrainerAthletesController))
        .map((module) => module.metatype),
    ).toEqual([SharedTrainerAthletesApiModule]);
    expect(
      modules
        .filter((module) => module.controllers.has(TrainerDashboardController))
        .map((module) => module.metatype),
    ).toEqual([TrainerTrainerAthletesApiModule]);
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
