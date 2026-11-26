import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
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
  patch: vi.fn(),
  setItem: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) =>
      key.endsWith(':keep-workout-screen-awake')
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
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ account: state.account, getApi: () => ({ PATCH: state.patch }) }),
}));

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

function TimerGate() {
  const enabled = useAppSettings(autoRestTimerEnabled);
  return <Text>{enabled ? 'automatic-on' : 'automatic-off'}</Text>;
}

function App() {
  return (
    <MobileThemeProvider>
      <LocaleProvider>
        <AppSettingsProvider>
          <AppSettingsScreen />
          <TimerGate />
        </AppSettingsProvider>
      </LocaleProvider>
    </MobileThemeProvider>
  );
}

const key = (id: string) => `gym-platform:app-settings:v1:${id}:auto-rest-timer`;

beforeEach(() => {
  state.account = { id: 'athlete-a' };
  state.getItem.mockReset().mockResolvedValue(null);
  state.getDuration.mockReset().mockResolvedValue(null);
  state.getFeedback.mockReset().mockResolvedValue(null);
  state.getKeepAwake.mockReset().mockResolvedValue(null);
  state.setItem.mockReset().mockResolvedValue(undefined);
  state.patch
    .mockReset()
    .mockResolvedValue({ response: { status: 200 }, data: { preferredLocale: 'uk' } });
});
afterEach(cleanup);

describe('App settings', () => {
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
    expect(state.setItem).toHaveBeenCalledWith(
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
    state.setItem.mockRejectedValue(new Error('storage error'));
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
    expect(state.setItem).toHaveBeenCalledWith(key('athlete-a'), 'false');
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
    state.setItem.mockRejectedValue(new Error('storage error'));
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
    await fireEvent(view.getByTestId('settings-auto-rest-timer'), 'valueChange', false);
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('automatic-on')).toBeTruthy();
    expect(view.getByTestId('settings-auto-rest-timer').props.value).toBe(true);
  });

  it('does not auto-start on a failed read and permits retry', async () => {
    state.getItem.mockRejectedValueOnce(new Error('storage error'));
    const view = await render(<App />);
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('automatic-off')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(view.getByText('automatic-on')).toBeTruthy());
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
      saveSound = useAppSettings((value) => value.setRestSound);
      saveDuration = useAppSettings((value) => value.setRestDuration);
      actionRender();
      return null;
    }
    function StatusProbe() {
      const status = useAppSettings((value) => value.settings.status);
      statusRender(status);
      return <Text>{status}</Text>;
    }
    const view = await render(
      <AppSettingsProvider>
        <DurationProbe />
        <ActionProbe />
        <StatusProbe />
      </AppSettingsProvider>,
    );
    await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
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

  it('waits for an old account write before rehydration and rejects stale actions after sign-out', async () => {
    const writes = new Map<string, Promise<void>>();
    const first = createAppSettingsStore('athlete-a', writes);
    const deactivate = first.activate();
    await waitFor(() => expect(first.store.getState().settings.status).toBe('ready'));
    let finish!: () => void;
    state.setItem.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const previous = first.store.getState();
    const pending = previous.setAutoRestTimer(false);
    await waitFor(() => expect(state.setItem).toHaveBeenCalledWith(key('athlete-a'), 'false'));
    expect(previous.shouldAutoStartRestTimer()).toBe(true);
    deactivate();
    expect(previous.shouldAutoStartRestTimer()).toBe(false);
    const next = createAppSettingsStore('athlete-a', writes);
    const closeNext = next.activate();
    const other = createAppSettingsStore('athlete-b', writes);
    const closeOther = other.activate();
    await waitFor(() => expect(other.store.getState().settings.status).toBe('ready'));
    expect(next.store.getState().settings.status).toBe('loading');
    expect(state.getItem.mock.calls.filter(([name]) => name === key('athlete-a'))).toHaveLength(1);
    await previous.setRestSound(false);
    expect(state.setItem).toHaveBeenCalledTimes(1);
    state.getItem.mockResolvedValue('false');
    finish();
    await pending;
    await waitFor(() => expect(next.store.getState().settings.status).toBe('ready'));
    expect(next.store.getState().shouldAutoStartRestTimer()).toBe(false);
    expect(other.store.getState().shouldAutoStartRestTimer()).toBe(true);
    expect(first.store.getState().settings.status).toBe('loading');
    expect(writes.size).toBe(0);
    closeNext();
    closeOther();
  });

  it('ignores stale hydration after switching account and reads the current auto-start preference', async () => {
    let finish!: (value: string | null) => void;
    state.getItem.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finish = resolve;
      }),
    );
    const writes = new Map<string, Promise<void>>();
    const first = createAppSettingsStore('athlete-a', writes);
    const closeFirst = first.activate();
    await waitFor(() => expect(state.getItem).toHaveBeenCalledWith(key('athlete-a')));
    closeFirst();
    const second = createAppSettingsStore('athlete-b', writes);
    const closeSecond = second.activate();
    await waitFor(() => expect(second.store.getState().settings.status).toBe('ready'));
    const gate = second.store.getState().shouldAutoStartRestTimer;
    expect(gate()).toBe(true);
    await second.store.getState().setAutoRestTimer(false);
    expect(gate()).toBe(false);
    finish(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(first.store.getState().settings.status).toBe('loading');
    expect(first.store.getState().shouldAutoStartRestTimer()).toBe(false);
    expect(gate()).toBe(false);
    closeSecond();
  });
});
