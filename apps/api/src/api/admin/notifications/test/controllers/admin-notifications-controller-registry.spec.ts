import { GUARDS_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AdminCookieRoute, ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { NotificationsModule } from '#src/modules/notifications/notifications.module';
import { AdminNotificationsApiModule } from '../../admin-notifications-api.module.js';
import { AdminNotificationInboxController } from '../../controllers/admin-notification-inbox.controller.js';

describe('Admin notifications adapter registry', () => {
  it('owns only the admin cookie-authenticated controller', () => {
    expect(AdminCookieRoute).toBeTypeOf('function');
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminNotificationsApiModule)).toEqual([
      AdminNotificationInboxController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminNotificationsApiModule)).toEqual([
      NotificationsModule,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, AdminNotificationInboxController)).toBe(
      'admin/notifications',
    );
    expect(Reflect.getMetadata(ADMIN_COOKIE_ROUTE, AdminNotificationInboxController)).toBe(true);
    expect(
      Reflect.getMetadata('authentication:route', AdminNotificationInboxController),
    ).toMatchObject({ public: false, providers: [AdminSessionCookieProvider] });
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminNotificationInboxController)).toEqual([
      AdminOriginGuard,
      AdminSessionPurposeGuard,
    ]);
  });
});
