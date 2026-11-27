import type { NotificationBehavior } from 'expo-notifications/build/Notifications.types';

export const SUPPRESS_FOREGROUND: Readonly<NotificationBehavior> = Object.freeze({
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
});
const SHOW_REMINDER: Readonly<NotificationBehavior> = Object.freeze({
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
});

export function foregroundReminderBehavior(
  notification: unknown,
  admit: (value: unknown) => boolean,
): NotificationBehavior {
  try {
    return admit(notification) ? { ...SHOW_REMINDER } : { ...SUPPRESS_FOREGROUND };
  } catch {
    return { ...SUPPRESS_FOREGROUND };
  }
}

let installation = 0;

/** Only the QA composition invokes this narrow import; the Expo barrel also
 * initializes push auto-registration. Keep a suppressing handler when the
 * owner unmounts, rather than restoring the library's default show behavior. */
export async function installReminderForegroundHandler(
  admit: (notification: unknown) => boolean,
  isMounted: () => boolean,
): Promise<boolean> {
  const revision = ++installation;
  try {
    const { setNotificationHandler } =
      await import('expo-notifications/build/NotificationsHandler');
    if (revision !== installation) return false;
    // Even if this mount has gone away, replace Expo's default-show
    // import side effect with a suppressing handler.
    setNotificationHandler({
      handleNotification: async (notification) =>
        foregroundReminderBehavior(
          notification,
          (value) => revision === installation && isMounted() && admit(value),
        ),
      // Never log raw notification/error payloads.
      handleError: () => undefined,
    });
    return isMounted();
  } catch {
    return false;
  }
}
