import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { TrainerOnboardingModule } from '#src/modules/trainer-onboarding/trainer-onboarding.module';
import { TrainerReviewController } from '../../controllers/trainer-review.controller.js';
import { AdminTrainerOnboardingApiModule } from '../../admin-trainer-onboarding-api.module.js';

describe('AdminTrainerOnboardingApiModule controller registry', () => {
  it('owns the review controller and preserves its exact guard order and cookie marker', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminTrainerOnboardingApiModule),
    ).toEqual([TrainerReviewController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminTrainerOnboardingApiModule)).toEqual([
      TrainerOnboardingModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerOnboardingModule)).not.toContain(
      TrainerReviewController,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, TrainerReviewController)).toEqual([
      AdminOriginGuard,
      AdminSessionPurposeGuard,
    ]);
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, TrainerReviewController)).toBe(true);
    expect(TrainerReviewController.name).toBe('TrainerReviewController');
  });
});

describe('Trainer review admin route registry', () => {
  it('enforces authentication before the service checks operator permissions', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TrainerReviewController)).toBe(
      'admin/trainer-applications',
    );
    expect(
      Reflect.getMetadata('required_admin_permissions', TrainerReviewController),
    ).toBeUndefined();
    expect(Reflect.getMetadata('authentication:route', TrainerReviewController)).toMatchObject({
      public: false,
      providers: [AdminSessionCookieProvider],
    });
  });

  it.each([
    ['findPending', RequestMethod.GET, '/', undefined, 60],
    ['approve', RequestMethod.POST, ':id/approve', 200, 3],
    ['reject', RequestMethod.POST, ':id/reject', 200, 3],
    ['revoke', RequestMethod.POST, ':id/revoke', 200, 3],
  ] as const)('declares %s as %s %s', (name, method, path, status, limit) => {
    const handler = TrainerReviewController.prototype[name];
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(handler.name).toBe(name);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(status);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
  });
});
