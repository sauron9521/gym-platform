import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AccountDeletionRequestsController } from '../../controllers/account-deletion-requests.controller.js';
import { AccountDeletionRequestsModule } from '#src/modules/account-deletion-requests/account-deletion-requests.module';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { SharedAccountDeletionRequestsApiModule } from '../../shared-account-deletion-requests-api.module.js';

describe('SharedAccountDeletionRequestsApiModule controller registry', () => {
  it('registers authenticated request intake and status under the current user’s route', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SharedAccountDeletionRequestsApiModule),
    ).toEqual([AccountDeletionRequestsController]);
    expect(Reflect.getMetadata(PATH_METADATA, AccountDeletionRequestsController)).toBe(
      'users/me/account-deletion-request',
    );
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, SharedAccountDeletionRequestsApiModule),
    ).toEqual([AccountDeletionRequestsModule]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AccountDeletionRequestsModule)).toEqual(
      [],
    );
    expect(
      Reflect.getMetadata('authentication:route', AccountDeletionRequestsController),
    ).toMatchObject({ public: false });
    expect(
      Reflect.getMetadata(ADMIN_COOKIE_ROUTE, AccountDeletionRequestsController),
    ).toBeUndefined();
    expect(AccountDeletionRequestsController.name).toBe('AccountDeletionRequestsController');
    const controller = AccountDeletionRequestsController.prototype;
    expect(Object.getOwnPropertyNames(controller)).toEqual(['constructor', 'findOwn', 'submit']);
    const findOwn = Object.getOwnPropertyDescriptor(controller, 'findOwn')?.value as object;
    const submit = Object.getOwnPropertyDescriptor(controller, 'submit')?.value as object;
    expect(Reflect.getMetadata(METHOD_METADATA, findOwn)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(METHOD_METADATA, submit)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, submit)).toBe(200);
  });

  it.each([
    ['findOwn', RequestMethod.GET, undefined, 60],
    ['submit', RequestMethod.POST, 200, 3],
  ] as const)(
    'preserves %s method name, path, status and stock rate-limit policy',
    (name, method, status, limit) => {
      const handler = AccountDeletionRequestsController.prototype[name];
      expect(handler.name).toBe(name);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(status);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
      expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
    },
  );
});
