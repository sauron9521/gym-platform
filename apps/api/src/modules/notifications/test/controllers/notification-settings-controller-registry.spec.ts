import { RequestMethod } from '@nestjs/common';
import { MODULE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NotificationSettingsController } from '../../controllers/notification-settings.controller.js';
import { NotificationsModule } from '../../notifications.module.js';

describe('Notifications controller registry', () => {
  it('registers the account-owned resource and exactly its two HTTP methods', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, NotificationsModule)).toEqual([
      NotificationSettingsController,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, NotificationSettingsController)).toBe(
      'users/me/notification-settings',
    );
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
});
