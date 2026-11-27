import { describe, expect, it, vi } from 'vitest';
import {
  classifyNativePermission,
  createNativePermissionAdapter,
  WORKOUT_REMINDER_CHANNEL,
} from '@/features/notifications/lib/native-notification-permission';

const granted = { status: 'granted', granted: true, canAskAgain: true };
const undetermined = { status: 'undetermined', granted: false, canAskAgain: true };
const denied = { status: 'denied', granted: false, canAskAgain: false };
function fixture(platform = 'android', initial: unknown = undetermined) {
  const getPermissionsAsync = vi.fn().mockResolvedValue(initial);
  const requestPermissionsAsync = vi.fn().mockResolvedValue(granted);
  const setNotificationChannelAsync = vi.fn().mockResolvedValue({ id: WORKOUT_REMINDER_CHANNEL });
  const deps = {
    platform,
    version: 34,
    supportedBuild: vi.fn(async () => true),
    loadPermissions: vi.fn(async () => ({ getPermissionsAsync, requestPermissionsAsync })),
    loadChannel: vi.fn(async () => ({ setNotificationChannelAsync })),
  };
  const adapter = createNativePermissionAdapter(deps);
  return {
    adapter,
    deps,
    getPermissionsAsync,
    requestPermissionsAsync,
    setNotificationChannelAsync,
  };
}
describe('native notification permission', () => {
  it('classifies only explicit consistent grants; iOS provisional and ephemeral are not full authorization', () => {
    expect(classifyNativePermission('android', granted)).toBe('granted');
    expect(classifyNativePermission('android', { ...granted, status: 'denied' })).toBe(
      'unavailable',
    );
    expect(
      classifyNativePermission('ios', { ...granted, ios: { status: 2, allowsAlert: true } }),
    ).toBe('granted');
    expect(
      classifyNativePermission('ios', { ...granted, ios: { status: 2, allowsAlert: false } }),
    ).toBe('denied');
    for (const status of [1, 3, 4])
      expect(classifyNativePermission('ios', { ...undetermined, ios: { status } })).toBe('denied');
    expect(classifyNativePermission('ios', { ...undetermined, ios: { status: 0 } })).toBe(
      'undetermined',
    );
    for (const value of [null, {}, true, { ...granted, canAskAgain: undefined }])
      expect(classifyNativePermission('android', value)).toBe('unavailable');
  });
  it('never loads native modules or prompts on web or unsupported builds', async () => {
    for (const platform of ['web', 'android']) {
      const f = fixture(platform);
      f.deps.supportedBuild.mockResolvedValue(false);
      expect(await f.adapter.read()).toEqual({ status: 'unavailable', canRequest: false });
      await f.adapter.request(() => true, 'Reminders');
      expect(f.deps.loadPermissions).not.toHaveBeenCalled();
      expect(f.deps.loadChannel).not.toHaveBeenCalled();
    }
  });
  it('read-only does not create channels or request permission, including Android first-use denied', async () => {
    const f = fixture('android', { ...denied, canAskAgain: true });
    expect(await f.adapter.read()).toEqual({ status: 'denied', canRequest: true });
    expect(f.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(f.requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it('creates Android channel only after explicit request and fresh requestable status', async () => {
    const f = fixture('android', { ...denied, canAskAgain: true });
    await f.adapter.request(() => true, 'Workout reminders');
    expect(f.setNotificationChannelAsync).toHaveBeenCalledExactlyOnceWith(
      WORKOUT_REMINDER_CHANNEL,
      { name: 'Workout reminders', importance: 5, lockscreenVisibility: 3 },
    );
    expect(f.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(f.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      f.requestPermissionsAsync.mock.invocationCallOrder[0]!,
    );
    f.getPermissionsAsync.mockResolvedValue(granted);
    expect(await f.adapter.read()).toEqual({ status: 'granted', canRequest: false });
  });
  it('does not prompt if revoked, permanently denied, granted, or malformed', async () => {
    for (const value of [denied, granted, {}]) {
      const f = fixture('android', value);
      await f.adapter.request(() => true, 'Reminders');
      expect(f.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(f.setNotificationChannelAsync).not.toHaveBeenCalled();
    }
    const f = fixture();
    let current = true;
    f.setNotificationChannelAsync.mockImplementation(async () => {
      current = false;
      return { id: WORKOUT_REMINDER_CHANNEL };
    });
    await f.adapter.request(() => current, 'Reminders');
    expect(f.requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it('requests iOS alert and sound only, never channels or provisional/badge permission', async () => {
    const f = fixture('ios', { ...undetermined, ios: { status: 0 } });
    await f.adapter.request(() => true, 'Reminders');
    expect(f.requestPermissionsAsync).toHaveBeenCalledExactlyOnceWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false, allowProvisional: false },
      android: {},
    });
    expect(f.deps.loadChannel).not.toHaveBeenCalled();
  });
  it('serializes concurrent prompts and releases the lock after errors', async () => {
    const f = fixture();
    let finish!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.requestPermissionsAsync.mockImplementationOnce(async () => {
      entered();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      throw new Error('native failed');
    });
    const pending = f.adapter.request(() => true, 'Reminders');
    await started;
    await fixture().adapter.request(() => true, 'Reminders');
    expect(f.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    await f.adapter.request(() => true, 'Reminders');
    expect(f.requestPermissionsAsync).toHaveBeenCalledTimes(2);
  });
  it('native module errors fail closed and unavailable channels never prompt', async () => {
    const f = fixture();
    f.getPermissionsAsync.mockRejectedValueOnce(new Error('missing'));
    expect(await f.adapter.read()).toEqual({ status: 'unavailable', canRequest: false });
    f.setNotificationChannelAsync.mockResolvedValue(null);
    await f.adapter.request(() => true, 'Reminders');
    expect(f.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
