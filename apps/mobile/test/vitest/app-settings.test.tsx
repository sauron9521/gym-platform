import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppSettingsProvider,
  useAppSettings,
} from '@/features/app-settings/model/app-settings-context';
import { AppSettingsScreen } from '@/screens/profile/ui/app-settings-screen';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';

const state = vi.hoisted(() => ({
  account: { id: 'athlete-a' },
  getItem: vi.fn(),
  setItem: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: state.getItem, setItem: state.setItem },
}));
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ account: state.account }),
}));

function TimerGate() {
  const { shouldAutoStartRestTimer } = useAppSettings();
  return <Text>{shouldAutoStartRestTimer() ? 'automatic-on' : 'automatic-off'}</Text>;
}

function App() {
  return (
    <IntlProvider locale="en" messages={getMobileMessages('en')}>
      <AppSettingsProvider>
        <AppSettingsScreen />
        <TimerGate />
      </AppSettingsProvider>
    </IntlProvider>
  );
}

const key = (id: string) => `gym-platform:app-settings:v1:${id}:auto-rest-timer`;

beforeEach(() => {
  state.account = { id: 'athlete-a' };
  state.getItem.mockReset().mockResolvedValue(null);
  state.setItem.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('App settings', () => {
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
