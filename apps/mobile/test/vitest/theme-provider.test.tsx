import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import * as RN from 'react-native';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mobilePalettes } from '@/shared/config/theme';
import {
  createThemedStyles,
  MobileThemeProvider,
  useMobileTheme,
} from '@/shared/config/theme-provider';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { ThemePicker } from '@/shared/ui/theme-picker';

const useStyles = createThemedStyles((palette) =>
  RN.StyleSheet.create({ label: { color: palette.text } }),
);
function Probe() {
  const { mode } = useMobileTheme();
  const styles = useStyles();
  const [count, setCount] = useState(0);
  return (
    <>
      <RN.Text testID="theme-probe" style={styles.label}>
        {mode}:{count}
      </RN.Text>
      <RN.Pressable testID="theme-count" onPress={() => setCount((previous) => previous + 1)} />
      <ThemePicker />
    </>
  );
}

function App() {
  return (
    <MobileThemeProvider>
      <IntlProvider locale="uk" messages={getMobileMessages('uk')}>
        <Probe />
      </IntlProvider>
    </MobileThemeProvider>
  );
}

describe('mobile theme preference', () => {
  beforeEach(() => {
    vi.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    vi.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('switches live styles, persists choice and preserves mounted state', async () => {
    const view = await render(<App />);
    expect(view.getByText('light:0')).toBeTruthy();
    expect(RN.StyleSheet.flatten(view.getByTestId('theme-probe').props.style).color).toBe(
      mobilePalettes.light.text,
    );
    await fireEvent.press(view.getByTestId('theme-count'));
    await fireEvent.press(view.getByTestId('theme-dark'));
    expect(view.getByText('dark:1')).toBeTruthy();
    expect(RN.StyleSheet.flatten(view.getByTestId('theme-probe').props.style).color).toBe(
      mobilePalettes.dark.text,
    );
    expect(view.getByTestId('theme-dark').props.accessibilityState.selected).toBe(true);
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('gym-platform:preferred-theme', 'dark'),
    );
    await fireEvent.press(view.getByTestId('theme-system'));
    expect(view.getByText('light:1')).toBeTruthy();
    vi.mocked(RN.useColorScheme).mockReturnValue('dark');
    await view.rerender(<App />);
    expect(view.getByText('dark:1')).toBeTruthy();
  });

  it('restores a valid saved choice instead of the system preference', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('dark');
    const view = await render(<App />);
    await waitFor(() => expect(view.getByText('dark:0')).toBeTruthy());
    expect(view.getByTestId('theme-dark').props.accessibilityState.selected).toBe(true);
  });

  it('ignores a late storage result after an explicit choice', async () => {
    let finish: (value: string) => void = () => undefined;
    vi.mocked(AsyncStorage.getItem).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = await render(<App />);
    await fireEvent.press(view.getByTestId('theme-light'));
    await act(async () => finish('dark'));
    expect(view.getByText('light:0')).toBeTruthy();
    expect(view.getByTestId('theme-light').props.accessibilityState.selected).toBe(true);
  });
});
