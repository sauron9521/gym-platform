import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { TrainerAthletesModule } from '#src/modules/trainer-athletes/trainer-athletes.module';
import { TrainerDashboardController } from '../../controllers/trainer-dashboard.controller.js';
import { TrainerTrainerAthletesApiModule } from '../../trainer-trainer-athletes-api.module.js';

describe('Trainer dashboard API controller registry', () => {
  it('owns the dashboard only and imports the controller-free core', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerTrainerAthletesApiModule),
    ).toEqual([TrainerDashboardController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, TrainerTrainerAthletesApiModule)).toEqual([
      TrainerAthletesModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerAthletesModule)).toEqual([]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerDashboardController)).toBe(
      'trainer-dashboard',
    );
    expect(Reflect.getMetadata('authentication:route', TrainerDashboardController)).toMatchObject({
      public: false,
    });
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, TrainerDashboardController)).toBeUndefined();
    expect(TrainerDashboardController.name).toBe('TrainerDashboardController');
    expect(Object.getOwnPropertyNames(TrainerDashboardController.prototype)).toEqual([
      'constructor',
      'overview',
      'clientProgress',
    ]);
  });

  it.each([
    ['overview', 'overview'],
    ['clientProgress', 'clients/:relationId/progress'],
  ] as const)('preserves the %s read-only contract and stable stock rate key', (name, path) => {
    const handler = TrainerDashboardController.prototype[name];
    expect(handler.name).toBe(name);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBeUndefined();
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(60);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
  });
});
