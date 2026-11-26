import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';

import { TrainerAthletesController } from '../../controllers/trainer-athletes.controller.js';
import { TrainerAthletesModule } from '#src/modules/trainer-athletes/trainer-athletes.module';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { SharedTrainerAthletesApiModule } from '../../shared-trainer-athletes-api.module.js';

describe('SharedTrainerAthletesApiModule controller registry', () => {
  it('owns only the relationship controller and imports the existing core', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SharedTrainerAthletesApiModule),
    ).toEqual([TrainerAthletesController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, SharedTrainerAthletesApiModule)).toEqual([
      TrainerAthletesModule,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerAthletesController)).toBe('trainer-athletes');
    expect(Reflect.getMetadata('authentication:route', TrainerAthletesController)).toMatchObject({
      public: false,
    });
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, TrainerAthletesController)).toBeUndefined();
    expect(TrainerAthletesController.name).toBe('TrainerAthletesController');
  });

  it.each([
    ['create', RequestMethod.POST, '/'],
    ['findMany', RequestMethod.GET, '/'],
    ['findOne', RequestMethod.GET, ':id'],
    ['accept', RequestMethod.POST, ':id/accept'],
    ['decline', RequestMethod.POST, ':id/decline'],
    ['cancel', RequestMethod.POST, ':id/cancel'],
    ['terminate', RequestMethod.POST, ':id/terminate'],
  ] as const)('preserves %s route method and path', (handler, method, path) => {
    const action = TrainerAthletesController.prototype[handler];
    expect(Reflect.getMetadata(METHOD_METADATA, action)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, action)).toBe(path);
    expect(action.name).toBe(handler);
    const isRead = method === RequestMethod.GET;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', action)).toBe(isRead ? 60 : undefined);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', action)).toBe(isRead ? 60_000 : undefined);
    expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', action)).toBeUndefined();
  });

  it('retains 201 for creation and explicit 200 statuses for transitions', () => {
    const controller = TrainerAthletesController.prototype;
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        Object.getOwnPropertyDescriptor(controller, 'create')?.value,
      ),
    ).toBeUndefined();
    for (const handler of ['accept', 'decline', 'cancel', 'terminate'] as const) {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller[handler])).toBe(200);
    }
  });

  it('does not register duplicate method/path combinations', () => {
    const routes = Object.getOwnPropertyNames(TrainerAthletesController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const action = Object.getOwnPropertyDescriptor(TrainerAthletesController.prototype, name)
          ?.value as (...args: unknown[]) => unknown;
        const method = Reflect.getMetadata(METHOD_METADATA, action) as RequestMethod;
        const path = Reflect.getMetadata(PATH_METADATA, action) as string;
        return `${method}:trainer-athletes/${path}`;
      });
    expect(routes).toHaveLength(7);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
