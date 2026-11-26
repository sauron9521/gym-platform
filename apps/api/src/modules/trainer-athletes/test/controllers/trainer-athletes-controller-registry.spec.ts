import { RequestMethod } from '@nestjs/common';
import { MODULE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { TrainerDashboardController } from '../../controllers/trainer-dashboard.controller.js';
import { TrainerAthletesModule } from '../../trainer-athletes.module.js';

describe('TrainerAthletesModule controller registry', () => {
  it('retains only the legacy dashboard controller during partial migration', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrainerAthletesModule)).toEqual([
      TrainerDashboardController,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerDashboardController)).toBe(
      'trainer-dashboard',
    );
    expect(Object.getOwnPropertyNames(TrainerDashboardController.prototype)).toEqual([
      'constructor',
      'overview',
      'clientProgress',
    ]);
    for (const [name, path] of [
      ['overview', 'overview'],
      ['clientProgress', 'clients/:relationId/progress'],
    ] as const) {
      const handler = TrainerDashboardController.prototype[name];
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    }
  });
});
