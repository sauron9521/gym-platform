import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  focusManager,
} from '@tanstack/react-query';
import { accountQueryKeys } from '@/shared/api/query-client';
import { confirmedWorkoutPreferencesKey } from '@/features/app-settings/model/account-workout-preferences';
import type {
  StoredWorkoutPreferences,
  WorkoutPreferencePatch,
} from '@/features/app-settings/model/account-workout-preferences';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppSettingsProvider,
  useAppSettings,
} from '@/features/app-settings/model/app-settings-context';
import {
  autoRestTimerEnabled,
  createAppSettingsStore,
} from '@/features/app-settings/model/app-settings-store';
import { AppSettingsScreen } from '@/screens/profile/ui/app-settings-screen';
import { LocaleProvider } from '@/shared/i18n/locale-provider';
import { MobileThemeProvider } from '@/shared/config/theme-provider';

const state = vi.hoisted(() => ({
  account: { id: 'athlete-a' },
  getItem: vi.fn(),
  getDuration: vi.fn(),
  getFeedback: vi.fn(),
  getKeepAwake: vi.fn(),
  getPreviousSets: vi.fn(),
  getAutoCollapse: vi.fn(),
  getConfirmCompletion: vi.fn(),
  patch: vi.fn(),
  setItem: vi.fn(),
  getRemote: vi.fn(),
  initialize: vi.fn(),
  patchWorkout: vi.fn(),
  getConfirmed: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) =>
      key.endsWith(':confirm-workout-completion')
        ? state.getConfirmCompletion(key)
        : key.endsWith(':auto-collapse-exercises')
          ? state.getAutoCollapse(key)
          : key.endsWith(':show-previous-sets')
            ? state.getPreviousSets(key)
            : key.endsWith(':confirmed-workout-preferences')
              ? state.getConfirmed(key)
              : key.endsWith(':keep-workout-screen-awake')
                ? state.getKeepAwake(key)
                : key.endsWith(':rest-sound') || key.endsWith(':rest-vibration')
                  ? state.getFeedback(key)
                  : key.endsWith(':rest-duration')
                    ? state.getDuration(key)
                    : key.includes(':app-settings:')
                      ? state.getItem(key)
                      : Promise.resolve(null),
    setItem: state.setItem,
  },
}));
const getScopedApi = (isCurrent: () => boolean) => {
  const id = state.account.id;
  return {
    GET: () => state.getRemote(id),
    POST: (_path: string, { body }: { body: WorkoutPreferencePatch }) => {
      if (!isCurrent()) throw new Error('session changed');
      return state.initialize(id, body);
    },
    PATCH: (_path: string, { body }: { body: WorkoutPreferencePatch }) => {
      if (!isCurrent()) throw new Error('session changed');
      return state.patchWorkout(id, body);
    },
  } as never;
};
const getApi = () => ({ PATCH: state.patch });
const verifiedCapabilities = { athlete: true, trainer: false, admin: false };
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({
    account: state.account,
    capabilities: verifiedCapabilities,
    getApi,
    getScopedApi,
    signOut: state.signOut,
  }),
}));

let client: QueryClient;
let server: Map<string, StoredWorkoutPreferences>;
const empty = () => ({ autoRestTimer: null, restDurationSeconds: null });
const result = (data: StoredWorkoutPreferences) => ({ response: { status: 200 }, data });
function verify(id: string) {
  if (!client.getQueryData(accountQueryKeys.me(id)))
    client.setQueryData(accountQueryKeys.me(id), { id });
}
function connection(id: string) {
  verify(id);
  return { queryClient: client, getScopedApi, signOut: state.signOut };
}
function Providers({ children }: { children: React.ReactNode }) {
  verify(state.account.id);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

function TimerGate() {
  const enabled = useAppSettings(autoRestTimerEnabled);
  return <Text>{enabled ? 'automatic-on' : 'automatic-off'}</Text>;
}

function App() {
  return (
    <Providers>
      <MobileThemeProvider>
        <LocaleProvider>
          <AppSettingsProvider>
            <AppSettingsScreen />
            <TimerGate />
          </AppSettingsProvider>
        </LocaleProvider>
      </MobileThemeProvider>
    </Providers>
  );
}

const key = (id: string) => `gym-platform:app-settings:v1:${id}:auto-rest-timer`;

beforeEach(() => {
  state.account = { id: 'athlete-a' };
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  server = new Map();
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
  state.getConfirmed.mockReset().mockResolvedValue(null);
  state.signOut.mockReset().mockResolvedValue(undefined);
  state.getRemote
    .mockReset()
    .mockImplementation(async (id: string) => result(server.get(id) ?? empty()));
  state.initialize
    .mockReset()
    .mockImplementation(async (id: string, body: WorkoutPreferencePatch) => {
      const previous = server.get(id) ?? empty();
      const next = {
        autoRestTimer: previous.autoRestTimer ?? body.autoRestTimer ?? null,
        restDurationSeconds: previous.restDurationSeconds ?? body.restDurationSeconds ?? null,
      };
      server.set(id, next);
      return result(next);
    });
  state.patchWorkout
    .mockReset()
    .mockImplementation(async (id: string, body: WorkoutPreferencePatch) => {
      const next = { ...(server.get(id) ?? empty()), ...body };
      server.set(id, next);
      return result(next);
    });
  state.getItem.mockReset().mockResolvedValue(null);
  state.getDuration.mockReset().mockResolvedValue(null);
  state.getFeedback.mockReset().mockResolvedValue(null);
  state.getKeepAwake.mockReset().mockResolvedValue(null);
  state.getPreviousSets.mockReset().mockResolvedValue(null);
  state.getAutoCollapse.mockReset().mockResolvedValue(null);
  state.getConfirmCompletion.mockReset().mockResolvedValue(null);
  state.setItem.mockReset().mockResolvedValue(undefined);
  state.patch
    .mockReset()
    .mockResolvedValue({ response: { status: 200 }, data: { preferredLocale: 'uk' } });
});
afterEach(async () => {
  await cleanup();
  client.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

describe('App settings', () => {
  it('defaults completion confirmation on, persists explicit false offline and isolates accounts', async () => {
    onlineManager.setOnline(false);
    const view = await render(<App />);
    const setting = () => view.getByTestId('settings-confirm-workout-completion');
    await waitFor(() => expect(setting().props.disabled).toBe(false));
    expect(setting().props.value).toBe(true);
    await fireEvent(setting(), 'valueChange', false);
    await waitFor(() => expect(setting().props.value).toBe(false));
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:confirm-workout-completion',
      'false',
    );
    expect(state.patchWorkout).not.toHaveBeenCalled();
    await view.unmount();
    state.getConfirmCompletion.mockResolvedValue('false');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-confirm-workout-completion').props.value).toBe(false),
    );
    state.account = { id: 'athlete-b' };
    state.getConfirmCompletion.mockResolvedValue('corrupt');
    await restored.rerender(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-confirm-workout-completion').props.disabled).toBe(
        false,
      ),
    );
    expect(restored.getByTestId('settings-confirm-workout-completion').props.value).toBe(true);
  });

  it('retains confirmation on failed disable write and unreadable storage', async () => {
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-confirm-workout-completion').props.disabled).toBe(false),
    );
    state.setItem.mockRejectedValueOnce(new Error('disk full'));
    await fireEvent(view.getByTestId('settings-confirm-workout-completion'), 'valueChange', false);
    await waitFor(() =>
      expect(view.getByTestId('settings-confirm-workout-completion').props.disabled).toBe(false),
    );
    expect(view.getByTestId('settings-confirm-workout-completion').props.value).toBe(true);
    await view.unmount();
    state.getConfirmCompletion.mockRejectedValueOnce(new Error('read failed'));
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByText('Could not save or read settings. Please try again.')).toBeTruthy(),
    );
    expect(restored.getByTestId('settings-confirm-workout-completion').props.value).toBe(true);
  });

  it('persists optional exercise collapse offline, restores it per account and defaults corrupt values off', async () => {
    onlineManager.setOnline(false);
    const view = await render(<App />);
    const setting = () => view.getByTestId('settings-auto-collapse-exercises');
    await waitFor(() => expect(setting().props.disabled).toBe(false));
    expect(setting().props.value).toBe(false);
    await fireEvent(setting(), 'valueChange', true);
    await waitFor(() => expect(setting().props.value).toBe(true));
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:auto-collapse-exercises',
      'true',
    );
    expect(state.patchWorkout).not.toHaveBeenCalled();
    await view.unmount();
    state.getAutoCollapse.mockResolvedValue('true');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-auto-collapse-exercises').props.value).toBe(true),
    );
    state.account = { id: 'athlete-b' };
    state.getAutoCollapse.mockResolvedValue('corrupt');
    await restored.rerender(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-auto-collapse-exercises').props.disabled).toBe(false),
    );
    expect(restored.getByTestId('settings-auto-collapse-exercises').props.value).toBe(false);
    expect(state.getAutoCollapse).toHaveBeenLastCalledWith(
      'gym-platform:app-settings:v1:athlete-b:auto-collapse-exercises',
    );
  });

  it('retains committed exercise collapse preference on failed write', async () => {
    state.getAutoCollapse.mockResolvedValue('true');
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-collapse-exercises').props.disabled).toBe(false),
    );
    state.setItem.mockRejectedValueOnce(new Error('disk full'));
    await fireEvent(view.getByTestId('settings-auto-collapse-exercises'), 'valueChange', false);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-collapse-exercises').props.disabled).toBe(false),
    );
    expect(view.getByTestId('settings-auto-collapse-exercises').props.value).toBe(true);
  });

  it('keeps previous results opt-in, saves offline and restores only the same account choice', async () => {
    onlineManager.setOnline(false);
    const view = await render(<App />);
    const setting = () => view.getByTestId('settings-show-previous-sets');
    await waitFor(() => expect(setting().props.disabled).toBe(false));
    expect(setting().props.value).toBe(false);
    await fireEvent(setting(), 'valueChange', true);
    await waitFor(() => expect(setting().props.value).toBe(true));
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:show-previous-sets',
      'true',
    );
    expect(state.patchWorkout).not.toHaveBeenCalled();
    await view.unmount();
    state.getPreviousSets.mockResolvedValue('true');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-show-previous-sets').props.value).toBe(true),
    );
    state.account = { id: 'athlete-b' };
    state.getPreviousSets.mockResolvedValue('corrupt');
    await restored.rerender(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-show-previous-sets').props.disabled).toBe(false),
    );
    expect(restored.getByTestId('settings-show-previous-sets').props.value).toBe(false);
    expect(state.getPreviousSets).toHaveBeenLastCalledWith(
      'gym-platform:app-settings:v1:athlete-b:show-previous-sets',
    );
  });

  it('defaults keep-awake on, persists it and isolates accounts', async () => {
    const view = await render(<App />);
    const setting = () => view.getByTestId('settings-keep-workout-screen-awake');
    await waitFor(() => expect(setting().props.disabled).toBe(false));
    expect(setting().props.value).toBe(true);
    await fireEvent(setting(), 'valueChange', false);
    await waitFor(() => expect(setting().props.value).toBe(false));
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:keep-workout-screen-awake',
      'false',
    );
    await view.unmount();
    state.getKeepAwake.mockResolvedValue('false');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-keep-workout-screen-awake').props.disabled).toBe(false),
    );
    expect(restored.getByTestId('settings-keep-workout-screen-awake').props.value).toBe(false);
    state.account = { id: 'athlete-b' };
    state.getKeepAwake.mockResolvedValue(null);
    await restored.rerender(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-keep-workout-screen-awake').props.value).toBe(true),
    );
    expect(state.getKeepAwake).toHaveBeenLastCalledWith(
      'gym-platform:app-settings:v1:athlete-b:keep-workout-screen-awake',
    );
  });

  it('persists sound and vibration independently of auto-start and restores both', async () => {
    state.getItem.mockResolvedValue('false');
    const view = await render(<App />);
    await waitFor(() => expect(view.getByTestId('settings-rest-sound').props.disabled).toBe(false));
    expect(view.getByTestId('settings-rest-sound').props.value).toBe(true);
    expect(view.getByTestId('settings-rest-vibration').props.value).toBe(true);
    await fireEvent(view.getByTestId('settings-rest-sound'), 'valueChange', false);
    await waitFor(() => expect(view.getByTestId('settings-rest-sound').props.value).toBe(false));
    expect(view.getByTestId('settings-rest-vibration').props.value).toBe(true);
    await fireEvent(view.getByTestId('settings-rest-vibration'), 'valueChange', false);
    await waitFor(() =>
      expect(view.getByTestId('settings-rest-vibration').props.value).toBe(false),
    );
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:rest-sound',
      'false',
    );
    expect(state.setItem).toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:rest-vibration',
      'false',
    );
    expect(view.getByText('automatic-off')).toBeTruthy();
    await view.unmount();
    state.getFeedback.mockResolvedValue('false');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-rest-sound').props.disabled).toBe(false),
    );
    expect(restored.getByTestId('settings-rest-sound').props.value).toBe(false);
    expect(restored.getByTestId('settings-rest-vibration').props.value).toBe(false);
  });

  it('saves the rest duration independently of auto-start and restores it on remount', async () => {
    state.getItem.mockResolvedValue('false');
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-rest-duration-90').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    expect(view.getByTestId('settings-rest-duration-90').props.accessibilityState.selected).toBe(
      true,
    );
    await fireEvent.press(view.getByTestId('settings-rest-duration-120'));
    await waitFor(() =>
      expect(view.getByTestId('settings-rest-duration-120').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    expect(state.patchWorkout).toHaveBeenCalledWith('athlete-a', { restDurationSeconds: 120 });
    expect(state.setItem).not.toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:rest-duration',
      '120',
    );
    expect(view.getByText('automatic-off')).toBeTruthy();
    await view.unmount();
    state.getDuration.mockResolvedValue('120');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(
        restored.getByTestId('settings-rest-duration-120').props.accessibilityState.selected,
      ).toBe(true),
    );
    state.account = { id: 'athlete-b' };
    state.getDuration.mockResolvedValue('invalid');
    await restored.rerender(<App />);
    await waitFor(() =>
      expect(
        restored.getByTestId('settings-rest-duration-90').props.accessibilityState.disabled,
      ).toBe(false),
    );
    expect(
      restored.getByTestId('settings-rest-duration-90').props.accessibilityState.selected,
    ).toBe(true);
    expect(state.getDuration).toHaveBeenLastCalledWith(
      'gym-platform:app-settings:v1:athlete-b:rest-duration',
    );
  });

  it('retains the saved duration when storage fails', async () => {
    state.getDuration.mockResolvedValue('60');
    state.patchWorkout.mockRejectedValueOnce(new Error('transport error'));
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-rest-duration-60').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    await fireEvent.press(view.getByTestId('settings-rest-duration-120'));
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByTestId('settings-rest-duration-60').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('groups existing appearance and account language controls and persists them through their original providers', async () => {
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
    expect(view.getByRole('header', { name: 'Workouts' })).toBeTruthy();
    expect(view.getByRole('header', { name: 'Display' })).toBeTruthy();
    expect(view.getByRole('header', { name: 'Language' })).toBeTruthy();
    await fireEvent.press(view.getByTestId('theme-dark'));
    expect(view.getByTestId('theme-dark').props.accessibilityState.selected).toBe(true);
    await waitFor(() =>
      expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-theme', 'dark'),
    );
    await fireEvent.press(view.getByText('Українська'));
    await waitFor(() => expect(view.getByRole('header', { name: 'Тренування' })).toBeTruthy());
    expect(state.patch).toHaveBeenCalledWith('/users/me/preferences', {
      body: { preferredLocale: 'uk' },
    });
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
    expect(view.getByText('automatic-on')).toBeTruthy();
  });

  it('retains the current language when account persistence fails', async () => {
    state.patch.mockResolvedValue({ response: { status: 503 } });
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
    await fireEvent.press(view.getByText('Українська'));
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByRole('header', { name: 'Language' })).toBeTruthy();
    expect(state.setItem).not.toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
  });

  it('defaults on, persists a change, and restores it after remount', async () => {
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
    await fireEvent(view.getByTestId('settings-auto-rest-timer'), 'valueChange', false);
    await waitFor(() => expect(view.getByText('automatic-off')).toBeTruthy());
    expect(state.patchWorkout).toHaveBeenCalledWith('athlete-a', { autoRestTimer: false });
    expect(state.setItem).not.toHaveBeenCalledWith(key('athlete-a'), 'false');
    await view.unmount();
    state.getItem.mockResolvedValue('false');
    const restored = await render(<App />);
    await waitFor(() =>
      expect(restored.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    expect(restored.getByText('automatic-off')).toBeTruthy();
    expect(restored.getByTestId('settings-auto-rest-timer').props.value).toBe(false);
  });

  it('isolates accounts and suppresses auto-start until the preference is loaded', async () => {
    state.getItem.mockResolvedValue('false');
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    let resolve!: (value: string | null) => void;
    state.getItem.mockReturnValue(
      new Promise<string | null>((done) => {
        resolve = done;
      }),
    );
    state.account = { id: 'athlete-b' };
    await view.rerender(<App />);
    expect(state.getItem).toHaveBeenLastCalledWith(key('athlete-b'));
    expect(view.getByText('automatic-off')).toBeTruthy();
    expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(true);
    await act(async () => resolve(null));
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
  });

  it('keeps the last saved preference when a write fails', async () => {
    state.patchWorkout.mockRejectedValueOnce(new Error('transport error'));
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
    await fireEvent(view.getByTestId('settings-auto-rest-timer'), 'valueChange', false);
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('automatic-on')).toBeTruthy();
    expect(view.getByTestId('settings-auto-rest-timer').props.value).toBe(true);
  });

  it('uses safe-off on unreadable legacy data and recovers on canonical GET', async () => {
    state.getItem.mockRejectedValueOnce(new Error('storage error'));
    state.getRemote.mockResolvedValueOnce({ response: { status: 403 } });
    const view = await render(<App />);
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('automatic-off')).toBeTruthy();
    server.set('athlete-a', { autoRestTimer: true, restDurationSeconds: 90 });
    await fireEvent.press(view.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
  });

  it('uses a confirmed offline snapshot, disables account changes and keeps device settings writable', async () => {
    onlineManager.setOnline(false);
    state.getConfirmed.mockResolvedValue(
      JSON.stringify({ autoRestTimer: false, restDurationSeconds: 120 }),
    );
    state.getItem.mockResolvedValue('true');
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-rest-duration-120').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(true);
    expect(view.getByText('automatic-off')).toBeTruthy();
    expect(state.getRemote).not.toHaveBeenCalled();
    await waitFor(() => expect(view.getByTestId('settings-rest-sound').props.disabled).toBe(false));
    await fireEvent(view.getByTestId('settings-rest-sound'), 'valueChange', false);
    await waitFor(() => expect(view.getByTestId('settings-rest-sound').props.value).toBe(false));
    expect(state.patchWorkout).not.toHaveBeenCalled();
    server.set('athlete-a', { autoRestTimer: true, restDurationSeconds: 60 });
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    expect(view.getByText('automatic-on')).toBeTruthy();
    expect(view.getByTestId('settings-rest-duration-60').props.accessibilityState.selected).toBe(
      true,
    );
    expect(state.patchWorkout).not.toHaveBeenCalled();
    expect(state.initialize).not.toHaveBeenCalled();
  });

  it('imports only missing legacy fields and never rewrites legacy keys', async () => {
    state.getItem.mockResolvedValue('false');
    state.getDuration.mockResolvedValue('120');
    server.set('athlete-a', { autoRestTimer: null, restDurationSeconds: 60 });
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    expect(state.initialize).toHaveBeenCalledExactlyOnceWith('athlete-a', { autoRestTimer: false });
    expect(view.getByText('automatic-off')).toBeTruthy();
    expect(view.getByTestId('settings-rest-duration-60').props.accessibilityState.selected).toBe(
      true,
    );
    await waitFor(() =>
      expect(state.setItem).toHaveBeenLastCalledWith(
        confirmedWorkoutPreferencesKey('athlete-a'),
        JSON.stringify({ autoRestTimer: false, restDurationSeconds: 60 }),
      ),
    );
    expect(state.setItem).not.toHaveBeenCalledWith(key('athlete-a'), 'false');
  });

  it('reconciles a lost PATCH acknowledgement by GET without replay', async () => {
    const view = await render(<App />);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    state.patchWorkout.mockImplementationOnce(async (id: string) => {
      server.set(id, { autoRestTimer: false, restDurationSeconds: 90 });
      throw new Error('response lost');
    });
    await fireEvent(view.getByTestId('settings-auto-rest-timer'), 'valueChange', false);
    await waitFor(() =>
      expect(view.getByTestId('settings-auto-rest-timer').props.disabled).toBe(false),
    );
    expect(view.getByText('automatic-off')).toBeTruthy();
    expect(state.patchWorkout).toHaveBeenCalledOnce();
    expect(state.getRemote.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('App settings store isolation and subscriptions', () => {
  it('does not render duration or action subscribers for unrelated saves', async () => {
    const durationRender = vi.fn();
    const actionRender = vi.fn();
    const statusRender = vi.fn();
    let saveSound!: (value: boolean) => Promise<void>;
    let saveDuration!: (value: 60 | 90 | 120) => Promise<void>;
    function DurationProbe() {
      const duration = useAppSettings((value) => value.settings.restDuration);
      durationRender(duration);
      return <Text>{duration}</Text>;
    }
    function ActionProbe() {
      const sound = useAppSettings((value) => value.setRestSound);
      const duration = useAppSettings((value) => value.setRestDuration);
      useEffect(() => {
        saveSound = sound;
        saveDuration = duration;
      }, [sound, duration]);
      actionRender();
      return null;
    }
    function StatusProbe() {
      const status = useAppSettings((value) => value.settings.status);
      statusRender(status);
      return <Text>{status}</Text>;
    }
    const view = await render(
      <Providers>
        <AppSettingsProvider>
          <DurationProbe />
          <ActionProbe />
          <StatusProbe />
        </AppSettingsProvider>
      </Providers>,
    );
    await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
    await waitFor(() => expect(state.getRemote).toHaveBeenCalled());
    await act(async () => {});
    const durationCount = durationRender.mock.calls.length;
    const actionCount = actionRender.mock.calls.length;
    const statusCount = statusRender.mock.calls.length;
    await act(async () => saveSound(false));
    expect(durationRender).toHaveBeenCalledTimes(durationCount);
    expect(actionRender).toHaveBeenCalledTimes(actionCount);
    expect(statusRender.mock.calls.length).toBeGreaterThan(statusCount);
    await act(async () => saveDuration(120));
    expect(view.getByText('120')).toBeTruthy();
    expect(durationRender.mock.calls.length).toBeGreaterThan(durationCount);
    expect(actionRender).toHaveBeenCalledTimes(actionCount);
  });

  it('waits for pending device writes on rehydration and rejects stale device actions', async () => {
    const writes = new Map<string, Promise<void>>();
    const snapshots = new Map<string, Promise<void>>();
    const first = createAppSettingsStore('athlete-a', writes, connection('athlete-a'), snapshots);
    const close = first.activate();
    await waitFor(() => expect(first.store.getState().settings.status).toBe('ready'));
    let finish!: () => void;
    state.setItem.mockImplementation((name: string) =>
      name.endsWith(':rest-sound')
        ? new Promise<void>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(),
    );
    const previous = first.store.getState();
    const pending = previous.setRestSound(false);
    await waitFor(() =>
      expect(state.setItem).toHaveBeenCalledWith(
        'gym-platform:app-settings:v1:athlete-a:rest-sound',
        'false',
      ),
    );
    close();
    const next = createAppSettingsStore('athlete-a', writes, connection('athlete-a'), snapshots);
    const closeNext = next.activate();
    expect(next.store.getState().settings.status).toBe('loading');
    await previous.setRestVibration(false);
    expect(state.setItem).not.toHaveBeenCalledWith(
      'gym-platform:app-settings:v1:athlete-a:rest-vibration',
      'false',
    );
    state.getFeedback.mockResolvedValue('false');
    finish();
    await pending;
    await waitFor(() => expect(next.store.getState().settings.status).toBe('ready'));
    expect(next.store.getState().settings.restSound).toBe(false);
    expect(writes.size).toBe(0);
    closeNext();
  });

  it('cancels an older GET before PATCH and serializes account writes', async () => {
    const instance = createAppSettingsStore(
      'athlete-a',
      new Map(),
      connection('athlete-a'),
      new Map(),
    );
    const close = instance.activate();
    await waitFor(() => expect(instance.store.getState().settings.accountStatus).toBe('ready'));
    let finishRead!: (value: unknown) => void;
    state.getRemote.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );
    const olderRead = client.refetchQueries({
      queryKey: accountQueryKeys.workoutPreferences('athlete-a'),
    });
    await waitFor(() => expect(state.getRemote).toHaveBeenCalledTimes(2));
    let finishWrite!: (value: unknown) => void;
    state.patchWorkout.mockReturnValueOnce(
      new Promise((resolve) => {
        finishWrite = resolve;
      }),
    );
    const write = instance.store.getState().setRestDuration(120);
    await waitFor(() => expect(state.patchWorkout).toHaveBeenCalledOnce());
    await instance.store.getState().setAutoRestTimer(false);
    expect(state.patchWorkout).toHaveBeenCalledOnce();
    server.set('athlete-a', { autoRestTimer: true, restDurationSeconds: 120 });
    finishWrite(result({ autoRestTimer: true, restDurationSeconds: 120 }));
    await write;
    finishRead(result({ autoRestTimer: false, restDurationSeconds: 60 }));
    await olderRead;
    await waitFor(() => expect(instance.store.getState().settings.accountStatus).toBe('ready'));
    expect(instance.store.getState().settings.restDuration).toBe(120);
    expect(instance.store.getState().shouldAutoStartRestTimer()).toBe(true);
    expect(client.getQueryData(accountQueryKeys.workoutPreferences('athlete-a'))).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 120,
    });
    close();
  });

  it('serializes confirmed snapshot writes across remount and retains the latest acknowledgement', async () => {
    const snapshots = new Map<string, Promise<void>>();
    let finishSnapshot!: () => void;
    const disk = new Map<string, string>();
    const storageKey = confirmedWorkoutPreferencesKey('athlete-a');
    state.setItem
      .mockImplementationOnce(
        (name: string, value: string) =>
          new Promise<void>((resolve) => {
            finishSnapshot = () => {
              disk.set(name, value);
              resolve();
            };
          }),
      )
      .mockImplementation(async (name: string, value: string) => {
        disk.set(name, value);
      });
    const first = createAppSettingsStore(
      'athlete-a',
      new Map(),
      connection('athlete-a'),
      snapshots,
    );
    const close = first.activate();
    await waitFor(() => expect(first.store.getState().settings.accountStatus).toBe('ready'));
    await waitFor(() => expect(finishSnapshot).toBeTypeOf('function'));
    await first.store.getState().setRestDuration(120);
    expect(first.store.getState().settings.restDuration).toBe(120);
    expect(state.setItem.mock.calls.filter(([name]) => name === storageKey)).toHaveLength(1);
    finishSnapshot();
    await waitFor(() =>
      expect(disk.get(storageKey)).toBe(
        JSON.stringify({ autoRestTimer: null, restDurationSeconds: 120 }),
      ),
    );
    close();
    client.clear();
    onlineManager.setOnline(false);
    state.getConfirmed.mockImplementation(async (name: string) => disk.get(name) ?? null);
    const second = createAppSettingsStore(
      'athlete-a',
      new Map(),
      connection('athlete-a'),
      snapshots,
    );
    const closeSecond = second.activate();
    await waitFor(() => expect(second.store.getState().settings.accountStatus).toBe('offline'));
    expect(second.store.getState().settings.restDuration).toBe(120);
    await second.store.getState().setRestDuration(60);
    expect(state.patchWorkout).toHaveBeenCalledOnce();
    closeSecond();
  });

  it('suppresses auto-start on an unreadable confirmed snapshot while offline', async () => {
    onlineManager.setOnline(false);
    state.getConfirmed.mockRejectedValueOnce(new Error('read failed'));
    const instance = createAppSettingsStore(
      'athlete-a',
      new Map(),
      connection('athlete-a'),
      new Map(),
    );
    const close = instance.activate();
    await waitFor(() => expect(instance.store.getState().settings.accountStatus).toBe('offline'));
    expect(instance.store.getState().shouldAutoStartRestTimer()).toBe(false);
    close();
  });

  it('fences late mutation acknowledgement even when the same account signs in again', async () => {
    const snapshots = new Map<string, Promise<void>>();
    const first = createAppSettingsStore(
      'athlete-a',
      new Map(),
      connection('athlete-a'),
      snapshots,
    );
    const close = first.activate();
    await waitFor(() => expect(first.store.getState().settings.accountStatus).toBe('ready'));
    let finish!: (value: unknown) => void;
    state.patchWorkout.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const action = first.store.getState().setAutoRestTimer(false);
    await waitFor(() => expect(state.patchWorkout).toHaveBeenCalledOnce());
    client.clear();
    expect(first.store.getState().shouldAutoStartRestTimer()).toBe(false);
    const next = createAppSettingsStore('athlete-a', new Map(), connection('athlete-a'), snapshots);
    const closeNext = next.activate();
    await waitFor(() => expect(next.store.getState().settings.accountStatus).toBe('ready'));
    finish(result({ autoRestTimer: false, restDurationSeconds: 120 }));
    await action;
    expect(next.store.getState().shouldAutoStartRestTimer()).toBe(true);
    expect(client.getQueryData(accountQueryKeys.workoutPreferences('athlete-a'))).toEqual(empty());
    close();
    closeNext();
  });
});
