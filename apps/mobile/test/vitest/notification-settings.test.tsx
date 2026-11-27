import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { getFlatMessages, type Locale } from '@gym/i18n';
import { IntlProvider } from 'react-intl';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { accountQueryKeys, createMobileQueryClient } from '@/shared/api/query-client';
import { NotificationSettingsPanel } from '@/features/notifications/ui/notification-settings-panel';
import { useAuth } from '@/features/auth/model/auth-context';
import type {
  NotificationSettings,
  SettingsPatch,
} from '@/features/notifications/services/settings-api';
import {
  readDevicePermission,
  type ReadDevicePermission,
} from '@/features/notifications/lib/notification-policy';
import { formatMinute, parseMinute } from '@/features/notifications/model/settings-time';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  signOut: vi.fn(),
  nativeRead: vi.fn(),
  nativeRequest: vi.fn(),
  qaEnabled: false,
}));
vi.mock('@/features/notifications/lib/native-notification-permission', () => ({
  readNativeDevicePermission: mocks.nativeRead,
  requestNativeDevicePermission: mocks.nativeRequest,
}));
vi.mock('@/features/notifications/lib/reminder-qa-mode', () => ({
  get REMINDER_QA_ENABLED() {
    return mocks.qaEnabled;
  },
}));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
}));

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const path = '/users/me/notification-settings';
const stamp = '2026-11-27T08:00:00.000Z';
const defaults: NotificationSettings = {
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
  timezone: 'Europe/Kyiv',
  preferences: [
    { category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'PROGRAM', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: false, consentedAt: null },
    { category: 'ACCOUNT', channel: 'EMAIL', enabled: false, consentedAt: null },
  ],
};
let client: ReturnType<typeof createMobileQueryClient>;
let stored: Map<string, NotificationSettings>;
let activeOwner: string;
const grants = { athlete: true, trainer: false, admin: false };
const ok = (data: unknown) => ({ response: { status: 200, ok: true }, data });
const fail = (status: number) => ({ response: { status, ok: false } });
const getScopedApi = (current: () => boolean) =>
  current() ? { GET: mocks.get, PATCH: mocks.patch } : null;
function auth(id: string | null) {
  activeOwner = id ?? '';
  vi.mocked(useAuth).mockReturnValue({
    account: id ? { id } : null,
    capabilities: id ? grants : null,
    getScopedApi,
    signOut: mocks.signOut,
  } as unknown as ReturnType<typeof useAuth>);
}
function verify(id: string) {
  client.setQueryData(accountQueryKeys.me(id), { id });
  auth(id);
}
const tree = (locale: Locale = 'en', readPermission?: ReadDevicePermission) => (
  <QueryClientProvider client={client}>
    <IntlProvider locale={locale} messages={getFlatMessages(locale)} timeZone="UTC">
      <NotificationSettingsPanel readPermission={readPermission} />
    </IntlProvider>
  </QueryClientProvider>
);
type View = Awaited<ReturnType<typeof render>>;
const toggle = (view: View, category = 'TRAINER') =>
  view.getByTestId('notification-consent-' + category);
async function ready(view: View) {
  await waitFor(() => expect(toggle(view).props.disabled).toBe(false));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.qaEnabled = false;
  mocks.nativeRead.mockResolvedValue({ status: 'unavailable', canRequest: false });
  mocks.nativeRequest.mockResolvedValue(undefined);
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  client = createMobileQueryClient();
  stored = new Map([
    [owner, structuredClone(defaults)],
    [other, structuredClone(defaults)],
  ]);
  verify(owner);
  mocks.signOut.mockImplementation(async () => {
    client.clear();
    auth(null);
  });
  mocks.get.mockImplementation(
    async (url: string, options: { headers: Record<string, string> }) => {
      if (url !== path) throw new Error('Unexpected GET');
      if (options.headers['x-notification-owner'] !== activeOwner) return fail(409);
      return ok(stored.get(activeOwner));
    },
  );
  mocks.patch.mockImplementation(
    async (url: string, options: { headers: Record<string, string>; body: SettingsPatch }) => {
      if (url !== path) throw new Error('Unexpected PATCH');
      if (options.headers['x-notification-owner'] !== activeOwner) return fail(409);
      const data = stored.get(activeOwner)!;
      const { preferences, ...fields } = options.body;
      const next = {
        ...data,
        ...fields,
        preferences: data.preferences.map((pair) => {
          const changed = preferences?.find(
            (value) => value.category === pair.category && value.channel === pair.channel,
          );
          return changed
            ? { ...pair, enabled: changed.enabled, consentedAt: changed.enabled ? stamp : null }
            : pair;
        }),
      };
      stored.set(activeOwner, next);
      return ok(next);
    },
  );
});
afterEach(async () => {
  await cleanup();
  client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('Mobile notification settings', () => {
  it('uses canonical off defaults, separate unknown OS permission, no implicit writes', async () => {
    const view = await render(tree());
    await ready(view);
    expect(view.getByText('Device notification permission')).toBeTruthy();
    expect(view.getByText('Unavailable')).toBeTruthy();
    expect(view.getByText('Account time zone: Europe/Kyiv')).toBeTruthy();
    expect(view.getByTestId('notification-quiet-start').props.value).toBe('22:00');
    expect(view.getByTestId('notification-quiet-end').props.value).toBe('08:00');
    expect(toggle(view).props.value).toBe(false);
    expect(view.getByTestId('notification-lead-60').props.accessibilityState.checked).toBe(true);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith(path, {
      headers: { 'x-notification-owner': owner },
      signal: expect.any(AbortSignal),
    });
  });

  it('labels internal QA only in the gated build, without a permission prompt', async () => {
    mocks.qaEnabled = true;
    const view = await render(tree());
    await ready(view);
    expect(view.getByTestId('notification-reminder-qa-mode')).toBeTruthy();
    expect(mocks.nativeRequest).not.toHaveBeenCalled();
    await view.unmount();
    mocks.qaEnabled = false;
    const ordinary = await render(tree());
    await ready(ordinary);
    expect(ordinary.queryByTestId('notification-reminder-qa-mode')).toBeNull();
  });

  it('requires a separate explicit permission action after confirmed local reminder consent, then rereads OS status', async () => {
    mocks.nativeRead.mockResolvedValue({ status: 'undetermined', canRequest: true });
    mocks.nativeRequest.mockImplementation(async (isCurrent: () => boolean) => {
      expect(isCurrent()).toBe(true);
      mocks.nativeRead.mockResolvedValue({ status: 'granted', canRequest: false });
    });
    const view = await render(tree());
    await ready(view);
    await waitFor(() => expect(view.getByText('Not requested')).toBeTruthy());
    expect(view.queryByTestId('notification-request-permission')).toBeNull();
    expect(mocks.nativeRequest).not.toHaveBeenCalled();
    await fireEvent(toggle(view, 'WORKOUT'), 'valueChange', true);
    await waitFor(() => expect(toggle(view, 'WORKOUT').props.value).toBe(true));
    await ready(view);
    expect(mocks.nativeRequest).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('notification-request-permission'));
    expect(mocks.nativeRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByText('Granted')).toBeTruthy());
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('notification-request-permission')).toBeNull();
  });

  it('does not treat non-requestable denied permission as a reason to prompt', async () => {
    mocks.nativeRead.mockResolvedValue({ status: 'denied', canRequest: false });
    const view = await render(tree());
    await ready(view);
    await fireEvent(toggle(view, 'WORKOUT'), 'valueChange', true);
    await waitFor(() => expect(toggle(view, 'WORKOUT').props.value).toBe(true));
    await ready(view);
    expect(view.getByText('Denied')).toBeTruthy();
    expect(view.queryByTestId('notification-request-permission')).toBeNull();
    expect(mocks.nativeRequest).not.toHaveBeenCalled();
  });

  it('saves one consent pair only, persists across remount and revokes without changing other preferences', async () => {
    const view = await render(tree());
    await ready(view);
    await fireEvent(toggle(view), 'valueChange', true);
    await waitFor(() => expect(toggle(view).props.value).toBe(true));
    await ready(view);
    expect(mocks.patch).toHaveBeenCalledExactlyOnceWith(path, {
      headers: { 'x-notification-owner': owner },
      body: { preferences: [{ category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: true }] },
    });
    await view.unmount();
    const reopened = await render(tree());
    await ready(reopened);
    expect(toggle(reopened).props.value).toBe(true);
    await fireEvent(toggle(reopened), 'valueChange', false);
    await waitFor(() => expect(toggle(reopened).props.value).toBe(false));
    expect(stored.get(owner)?.preferences).toEqual(defaults.preferences);
  });

  it('validates and saves both quiet endpoints and lead independently of consent', async () => {
    const view = await render(tree());
    await ready(view);
    await fireEvent.changeText(view.getByTestId('notification-quiet-end'), '22:00');
    expect(view.getByText('Choose two different valid times.')).toBeTruthy();
    expect(view.getByTestId('notification-save-times').props.accessibilityState.disabled).toBe(
      true,
    );
    await fireEvent.changeText(view.getByTestId('notification-quiet-start'), '23:15');
    await fireEvent.changeText(view.getByTestId('notification-quiet-end'), '07:30');
    expect(view.getByText('This interval continues across midnight.')).toBeTruthy();
    await fireEvent.press(view.getByTestId('notification-save-times'));
    await waitFor(() => expect(stored.get(owner)?.quietStartMinute).toBe(1395));
    await ready(view);
    expect(mocks.patch.mock.calls[0]?.[1].body).toEqual({
      quietStartMinute: 1395,
      quietEndMinute: 450,
    });
    await fireEvent.press(view.getByTestId('notification-lead-1440'));
    await waitFor(() => expect(stored.get(owner)?.reminderLeadMinutes).toBe(1440));
    await ready(view);
    expect(stored.get(owner)?.preferences).toEqual(defaults.preferences);
    await fireEvent(view.getByTestId('notification-quiet-enabled'), 'valueChange', false);
    await waitFor(() => expect(stored.get(owner)?.quietHoursEnabled).toBe(false));
  });

  it('separates all native permission states from the server, including Ukrainian denied warning', async () => {
    for (const [permission, text] of [
      ['granted', 'Granted'],
      ['denied', 'Denied'],
      ['undetermined', 'Not requested'],
    ] as const) {
      const reader = vi.fn(async () => permission);
      const view = await render(tree('en', reader));
      await ready(view);
      await waitFor(() => expect(view.getByText(text)).toBeTruthy());
      expect(toggle(view).props.value).toBe(false);
      expect(reader).toHaveBeenCalled();
      if (permission === 'denied')
        expect(
          view.getByText(
            'Your device blocks notifications. Account preferences do not override the device setting.',
          ),
        ).toBeTruthy();
      await view.unmount();
    }
    const view = await render(tree('uk', async () => 'denied'));
    await waitFor(() => expect(view.getByText('Відхилено')).toBeTruthy());
    expect(
      view.getByText(
        'Пристрій блокує сповіщення. Налаштування акаунта не змінюють системний дозвіл.',
      ),
    ).toBeTruthy();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(
      await readDevicePermission(async () => {
        throw new Error('native unavailable');
      }),
    ).toBe('unavailable');
    expect(await readDevicePermission(async () => 'not-a-permission')).toBe('unavailable');
  });

  it('does not optimistically grant consent or replay failed writes, reconciles by GET', async () => {
    const view = await render(tree());
    await ready(view);
    let finish!: (v: unknown) => void;
    mocks.patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const prior = mocks.get.mock.calls.length;
    await fireEvent(toggle(view), 'valueChange', true);
    await waitFor(() => expect(toggle(view).props.disabled).toBe(true));
    expect(toggle(view).props.value).toBe(false);
    await fireEvent(toggle(view), 'valueChange', true);
    const canonical = stored.get(owner)!;
    canonical.preferences[0] = { ...canonical.preferences[0]!, enabled: true, consentedAt: stamp };
    await act(async () => finish(fail(503)));
    await waitFor(() =>
      expect(
        view.getByText(
          'Could not confirm the change. Review the current settings before trying again.',
        ),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(toggle(view).props.value).toBe(true));
    expect(mocks.patch).toHaveBeenCalledOnce();
    expect(mocks.get.mock.calls.length).toBeGreaterThan(prior);
  });

  it('does not queue offline writes and refreshes after reconnect', async () => {
    const view = await render(tree());
    await ready(view);
    await act(async () => onlineManager.setOnline(false));
    expect(toggle(view).props.disabled).toBe(true);
    await fireEvent(toggle(view), 'valueChange', true);
    await act(async () => onlineManager.setOnline(true));
    await ready(view);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(toggle(view).props.value).toBe(false);
  });

  it('hides settings when the server rejects the owner fence or grant', async () => {
    const view = await render(tree());
    await ready(view);
    for (const status of [409, 403]) {
      mocks.patch.mockResolvedValueOnce(fail(status));
      await fireEvent(toggle(view), 'valueChange', true);
      await waitFor(() =>
        expect(
          view.getByText('Account access changed. Reopen this page after verifying your session.'),
        ).toBeTruthy(),
      );
      expect(view.queryByTestId('notification-consent-TRAINER')).toBeNull();
      expect(mocks.signOut).not.toHaveBeenCalled();
      await fireEvent.press(view.getByRole('button', { name: 'Reload notification settings' }));
      await ready(view);
    }
    expect(stored.get(owner)?.preferences).toEqual(defaults.preferences);
  });

  it('discards late 401 after account switch; re-verification cannot reuse old settings', async () => {
    const view = await render(tree());
    await ready(view);
    let finish!: (v: unknown) => void;
    mocks.patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent(toggle(view), 'valueChange', true);
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledOnce());
    await act(async () => {
      client.clear();
      verify(other);
    });
    await view.rerender(tree());
    await ready(view);
    await act(async () => finish(fail(401)));
    expect(toggle(view).props.value).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(client.getQueryData(accountQueryKeys.notificationSettings(owner))).toBeUndefined();
    expect(client.getQueryData(accountQueryKeys.notificationSettings(other))).toEqual(defaults);
  });

  it('rejects malformed server state and validates exact wall-clock input', async () => {
    mocks.get.mockResolvedValueOnce(
      ok({ ...defaults, preferences: defaults.preferences.slice(0, 3) }),
    );
    const view = await render(tree());
    await waitFor(() =>
      expect(view.getByText('Could not load notification settings.')).toBeTruthy(),
    );
    expect(view.queryByTestId('notification-consent-TRAINER')).toBeNull();
    expect(parseMinute('24:00')).toBeNull();
    expect(parseMinute('7:00')).toBeNull();
    expect(parseMinute('23:59')).toBe(1439);
    expect(formatMinute(0)).toBe('00:00');
  });
  it('expires only the current authorized session on a 401', async () => {
    const view = await render(tree());
    await ready(view);
    mocks.patch.mockResolvedValueOnce(fail(401));
    await fireEvent(toggle(view), 'valueChange', true);
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    await view.rerender(tree());
    expect(view.queryByTestId('notification-consent-TRAINER')).toBeNull();
    expect(client.getQueryData(accountQueryKeys.notificationSettings(owner))).toBeUndefined();
  });

  it('ignores a late success after backgrounding and same-account re-verification', async () => {
    const view = await render(tree());
    await ready(view);
    let finish!: (value: unknown) => void;
    mocks.patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent(toggle(view), 'valueChange', true);
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledOnce());
    await act(async () => {
      focusManager.setFocused(false);
      client.clear();
      auth(null);
    });
    await view.rerender(tree());
    expect(view.queryByTestId('notification-consent-TRAINER')).toBeNull();
    await act(async () => {
      verify(owner);
      focusManager.setFocused(true);
    });
    await view.rerender(tree());
    await ready(view);
    const late = structuredClone(defaults);
    late.preferences[0] = { ...late.preferences[0]!, enabled: true, consentedAt: stamp };
    await act(async () => finish(ok(late)));
    expect(toggle(view).props.value).toBe(false);
    expect(client.getQueryData(accountQueryKeys.notificationSettings(owner))).toEqual(defaults);
    expect(mocks.patch).toHaveBeenCalledOnce();
  });
});
