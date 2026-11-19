import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { TrainerApplicationsController } from '../../controllers/trainer-applications.controller.js';
import { TrainerReviewController } from '../../controllers/trainer-review.controller.js';
import { TrainerOnboardingModule } from '../../trainer-onboarding.module.js';

describe('TrainerOnboardingModule controller registry', () => {
  it('registers exactly the protected application controller', () => {
    const controllers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      TrainerOnboardingModule,
    );
    expect(controllers).toEqual([TrainerApplicationsController, TrainerReviewController]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerApplicationsController)).toBe(
      'trainer-applications',
    );
  });

  it.each([
    ['findMine', RequestMethod.GET, 'me'],
    ['submit', RequestMethod.POST, '/'],
    ['updateMine', RequestMethod.PATCH, 'me'],
  ] as const)('keeps the %s route %s %s', (methodName, method, path) => {
    const handler = TrainerApplicationsController.prototype[methodName];
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
  });
});

describe('Trainer review admin route registry', () => {
  it('enforces authentication before the service checks operator permissions', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TrainerReviewController)).toBe(
      'admin/trainer-applications',
    );
    expect(Reflect.getMetadata('required_admin_permissions', TrainerReviewController)).toBeUndefined();
  });


  it.each([
    ['findPending', RequestMethod.GET, '/'],
    ['approve', RequestMethod.POST, ':id/approve'],
    ['reject', RequestMethod.POST, ':id/reject'],
    ['revoke', RequestMethod.POST, ':id/revoke'],
  ] as const)('declares %s as %s %s', (name, method, path) => {
    const handler = TrainerReviewController.prototype[name];
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
  });
});
