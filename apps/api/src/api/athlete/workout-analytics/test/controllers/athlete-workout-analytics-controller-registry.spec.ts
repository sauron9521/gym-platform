import { RequestMethod } from '@nestjs/common';
import {
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';

import { WorkoutAnalyticsController } from '../../controllers/workout-analytics.controller.js';
import { WorkoutAnalyticsModule } from '#src/modules/workout-analytics/workout-analytics.module';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AthleteWorkoutAnalyticsApiModule } from '../../athlete-workout-analytics-api.module.js';

describe('AthleteWorkoutAnalyticsApiModule controller registry', () => {
  it('registers only the analytics controller under the original route prefix', () => {
    const controllers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AthleteWorkoutAnalyticsApiModule,
    );

    expect(controllers).toEqual([WorkoutAnalyticsController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AthleteWorkoutAnalyticsApiModule)).toEqual([
      WorkoutAnalyticsModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkoutAnalyticsModule)).toEqual([]);
    expect(Reflect.getMetadata('authentication:route', WorkoutAnalyticsController)).toMatchObject({
      public: false,
    });
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, WorkoutAnalyticsController)).toBeUndefined();
    expect(WorkoutAnalyticsController.name).toBe('WorkoutAnalyticsController');
    expect(Reflect.getMetadata(PATH_METADATA, WorkoutAnalyticsController)).toBe(
      'workout-analytics',
    );
  });

  it.each([
    ['summary', RequestMethod.GET, 'summary'],
    ['personalRecords', RequestMethod.GET, 'personal-records'],
    ['exercise', RequestMethod.GET, 'exercises/:exerciseId'],
    ['previousSets', RequestMethod.GET, 'exercises/:exerciseId/previous-sets'],
  ] as const)('preserves the %s HTTP method and path', (name, method, path) => {
    const handler = WorkoutAnalyticsController.prototype[name];

    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(handler.name).toBe(name);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBeUndefined();
  });

  it('keeps the 20-per-minute throttling on all analytics endpoints', () => {
    const handlers = WorkoutAnalyticsController.prototype;
    for (const name of ['summary', 'personalRecords', 'exercise', 'previousSets'] as const) {
      const handler = Object.getOwnPropertyDescriptor(handlers, name)?.value;
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(20);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
      expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
    }
  });

  it('preserves the explicit private no-store previous-set response', () => {
    expect(
      Reflect.getMetadata(
        HEADERS_METADATA,
        Object.getOwnPropertyDescriptor(WorkoutAnalyticsController.prototype, 'previousSets')
          ?.value,
      ),
    ).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
  });

  it('registers exactly four unique HTTP method/path pairs', () => {
    const routes = Object.getOwnPropertyNames(WorkoutAnalyticsController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const handler = Object.getOwnPropertyDescriptor(WorkoutAnalyticsController.prototype, name)
          ?.value as (...args: unknown[]) => unknown;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
        return `${method}:workout-analytics/${path}`;
      });

    expect(routes).toHaveLength(4);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
