import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { SharedTrainerOnboardingApiModule } from '../../shared-trainer-onboarding-api.module.js';

import { TrainerApplicationsController } from '../../controllers/trainer-applications.controller.js';
import { TrainerOnboardingModule } from '#src/modules/trainer-onboarding/trainer-onboarding.module';

describe('SharedTrainerOnboardingApiModule controller registry', () => {
  it('owns the only ordinary application controller and keeps core controller-free', () => {
    const controllers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      SharedTrainerOnboardingApiModule,
    );
    expect(controllers).toEqual([TrainerApplicationsController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, SharedTrainerOnboardingApiModule)).toEqual([
      TrainerOnboardingModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerOnboardingModule)).toEqual([]);
    expect(
      Reflect.getMetadata('authentication:route', TrainerApplicationsController),
    ).toMatchObject({ public: false });
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, TrainerApplicationsController)).toBeUndefined();
    expect(TrainerApplicationsController.name).toBe('TrainerApplicationsController');
    expect(Object.getOwnPropertyNames(TrainerApplicationsController.prototype)).toEqual([
      'constructor',
      'findMine',
      'submit',
      'updateMine',
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerApplicationsController)).toBe(
      'trainer-applications',
    );
  });

  it.each([
    ['findMine', RequestMethod.GET, 'me', 60],
    ['submit', RequestMethod.POST, '/', 3],
    ['updateMine', RequestMethod.PATCH, 'me', 3],
  ] as const)('keeps the %s route %s %s', (methodName, method, path, limit) => {
    const handler = TrainerApplicationsController.prototype[methodName];
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(handler.name).toBe(methodName);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBeUndefined();
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
  });
});
