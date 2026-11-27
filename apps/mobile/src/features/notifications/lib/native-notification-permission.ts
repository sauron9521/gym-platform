import { Platform } from 'react-native';
import type { DevicePermission } from './notification-policy';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';

// Deliberately load only the permission/channel modules of the pinned Expo
// package. Its barrel also initializes the push auto-registration listener.
type PermissionModule = Pick<
  typeof import('expo-notifications/build/NotificationPermissions'),
  'getPermissionsAsync' | 'requestPermissionsAsync'
>;
type ChannelModule = typeof import('expo-notifications/build/setNotificationChannelAsync');
export const WORKOUT_REMINDER_CHANNEL = 'workout-reminders';
type Dependencies = {
  platform: string;
  version: string | number;
  supportedBuild: () => Promise<boolean>;
  loadPermissions: () => Promise<PermissionModule>;
  loadChannel: () => Promise<ChannelModule>;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Only full alert authorization counts. Provisional/ephemeral iOS grants
 * are not permission to schedule workout alerts. Unknown evidence fails closed. */
export function classifyNativePermission(platform: string, value: unknown): DevicePermission {
  const response = record(value);
  if (
    !response ||
    typeof response.granted !== 'boolean' ||
    typeof response.canAskAgain !== 'boolean'
  )
    return 'unavailable';
  if (platform === 'ios') {
    const ios = record(response.ios);
    if (
      ios?.status === IosAuthorizationStatus.NOT_DETERMINED &&
      response.status === 'undetermined' &&
      !response.granted
    )
      return 'undetermined';
    if (
      ios?.status === IosAuthorizationStatus.DENIED ||
      ios?.status === IosAuthorizationStatus.PROVISIONAL ||
      ios?.status === IosAuthorizationStatus.EPHEMERAL
    )
      return 'denied';
    return ios?.status === IosAuthorizationStatus.AUTHORIZED &&
      response.status === 'granted' &&
      response.granted &&
      ios.allowsAlert === true
      ? 'granted'
      : ios?.status === IosAuthorizationStatus.AUTHORIZED && ios.allowsAlert === false
        ? 'denied'
        : 'unavailable';
  }
  if (platform !== 'android') return 'unavailable';
  // Expo's Android status already incorporates areNotificationsEnabled.
  // Channel importance is a separate native scheduling gate.
  if (response.status === 'granted' && response.granted) return 'granted';
  if (response.status === 'denied' && !response.granted) return 'denied';
  if (response.status === 'undetermined' && !response.granted) return 'undetermined';
  return 'unavailable';
}

export type NativePermissionSnapshot = Readonly<{ status: DevicePermission; canRequest: boolean }>;
const unavailable: NativePermissionSnapshot = Object.freeze({
  status: 'unavailable',
  canRequest: false,
});

function canRequestPermission(platform: string, value: unknown): boolean {
  const response = record(value);
  const status = classifyNativePermission(platform, value);
  return (
    response?.canAskAgain === true &&
    (status === 'undetermined' ||
      (platform === 'android' && status === 'denied' && response.granted === false))
  );
}

let promptInFlight = false;
export function createNativePermissionAdapter(deps: Dependencies) {
  const supported = () =>
    (deps.platform === 'android' || deps.platform === 'ios') && deps.supportedBuild();
  return {
    async read(): Promise<NativePermissionSnapshot> {
      try {
        if (!(await supported())) return unavailable;
        const native = await deps.loadPermissions();
        const value = await native.getPermissionsAsync();
        return {
          status: classifyNativePermission(deps.platform, value),
          canRequest: canRequestPermission(deps.platform, value),
        };
      } catch {
        return unavailable;
      }
    },
    async request(isCurrent: () => boolean, channelName: string): Promise<void> {
      // Global lock covers unmount/remount and concurrent accounts. Never
      // expose the response as an account grant; the caller must re-read.
      if (promptInFlight || !isCurrent()) return;
      promptInFlight = true;
      try {
        if (!(await supported()) || !isCurrent()) return;
        const native = await deps.loadPermissions();
        if (!isCurrent()) return;
        const before = await native.getPermissionsAsync();
        if (!isCurrent() || !canRequestPermission(deps.platform, before)) return;
        if (deps.platform === 'android' && Number(deps.version) >= 26) {
          const channel = await deps.loadChannel();
          if (!isCurrent()) return;
          // Android 13 needs a channel before the notification permission prompt.
          // No exact-alarm permission, badge, private payload or schedule.
          const created = await channel.setNotificationChannelAsync(WORKOUT_REMINDER_CHANNEL, {
            name: channelName,
            importance: AndroidImportance.DEFAULT,
            lockscreenVisibility: AndroidNotificationVisibility.SECRET,
          });
          if (!created || !isCurrent()) return;
        }
        if (!isCurrent()) return;
        await native.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false, allowProvisional: false },
          android: {},
        });
      } catch {
        // The status reader reports unavailable when the native module fails.
      } finally {
        promptInFlight = false;
      }
    },
  };
}

const nativePermission = createNativePermissionAdapter({
  platform: Platform.OS,
  version: Platform.Version,
  supportedBuild: async () => !(await import('expo')).isRunningInExpoGo(),
  loadPermissions: () => import('expo-notifications/build/NotificationPermissions'),
  loadChannel: () => import('expo-notifications/build/setNotificationChannelAsync'),
});
export const readNativeDevicePermission = nativePermission.read;
export const requestNativeDevicePermission = nativePermission.request;
