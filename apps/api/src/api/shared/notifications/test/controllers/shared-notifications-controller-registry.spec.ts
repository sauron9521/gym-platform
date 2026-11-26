import { RequestMethod } from '@nestjs/common';
import {
  MODULE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  HTTP_CODE_METADATA,
  HEADERS_METADATA,
} from '@nestjs/common/constants';
import { NotificationSettingsController } from '../../controllers/notification-settings.controller.js';
import { NotificationsModule } from '#src/modules/notifications/notifications.module';
import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { SharedNotificationsApiModule } from '../../shared-notifications-api.module.js';

describe('SharedNotificationsApiModule controller registry', () => {
  it('registers the account-owned resource and exactly its two HTTP methods', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SharedNotificationsApiModule)).toEqual([
      NotificationSettingsController,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, NotificationSettingsController)).toBe(
      'users/me/notification-settings',
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, SharedNotificationsApiModule)).toEqual([
      NotificationsModule,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, NotificationsModule)).toEqual([]);
    expect(
      Reflect.getMetadata('authentication:route', NotificationSettingsController),
    ).toMatchObject({ public: false });
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, NotificationSettingsController)).toBeUndefined();
    expect(NotificationSettingsController.name).toBe('NotificationSettingsController');
    const methods = NotificationSettingsController.prototype;
    expect(Object.getOwnPropertyNames(methods).sort()).toEqual(['constructor', 'get', 'patch']);
    expect(
      Reflect.getMetadata(METHOD_METADATA, Object.getOwnPropertyDescriptor(methods, 'get')?.value),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        Object.getOwnPropertyDescriptor(methods, 'patch')?.value,
      ),
    ).toBe(RequestMethod.PATCH);
  });

  it.each([
    ['get', RequestMethod.GET, 60, 60_000],
    ['patch', RequestMethod.PATCH, undefined, undefined],
  ] as const)(
    'preserves %s method name, cache header and stock rate-limit policy',
    (name, method, limit, ttl) => {
      const handler = NotificationSettingsController.prototype[name];
      expect(handler.name).toBe(name);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBeUndefined();
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
        { name: 'Cache-Control', value: 'no-store' },
      ]);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(ttl);
      expect(Reflect.getMetadata('THROTTLER:KEY_GENERATORdefault', handler)).toBeUndefined();
    },
  );
});
