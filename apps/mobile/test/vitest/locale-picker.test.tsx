import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useIntl } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountLocaleSync } from '@/shared/i18n/account-locale-sync';
import { LocalePicker } from '@/shared/i18n/locale-picker';
import { LocaleProvider } from '@/shared/i18n/locale-provider';

const state = vi.hoisted(() => ({
  account: null as null | { id: string; preferredLocale: 'uk' | 'en' | null },
  patch: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: state.getItem, setItem: state.setItem },
}));

vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ account: state.account, getApi: () => ({ PATCH: state.patch }) }),
}));

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

function TranslatedHeading() {
  const intl = useIntl();
  return <Text>{intl.formatMessage({ id: 'mobile.profile.myProfile' })}</Text>;
}

function renderPicker(syncAccount = false) {
  return render(
    <LocaleProvider>
      {syncAccount ? <AccountLocaleSync /> : null}
      <TranslatedHeading />
      <LocalePicker />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  state.account = null;
  state.patch.mockReset();
  state.getItem.mockReset().mockResolvedValue(null);
  state.setItem.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Mobile language persistence and verified account preference', () => {
  it('uses the device language if the stored preference is missing or invalid', async () => {
    state.getItem.mockResolvedValue('unexpected-locale');
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());
    expect(state.getItem).toHaveBeenCalledWith('gym-platform:preferred-locale');
    expect(state.setItem).not.toHaveBeenCalled();
  });

  it('falls back to device language after a storage read error', async () => {
    state.getItem.mockRejectedValue(new Error('storage unavailable'));
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());
  });

  it('hydrates the persisted Ukrainian preference before showing the UI', async () => {
    state.getItem.mockResolvedValue('uk');
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('Мій профіль')).toBeTruthy());
    expect(view.queryByText('My profile')).toBeNull();
  });

  it('persists a guest language choice and updates translations both ways', async () => {
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());

    fireEvent.press(view.getByText('Українська'));
    await waitFor(() => expect(view.getByText('Мій профіль')).toBeTruthy());
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
    expect(state.patch).not.toHaveBeenCalled();

    fireEvent.press(view.getByText('English'));
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'en');
  });

  it('retains the selected language and storage when account PATCH fails', async () => {
    state.account = { id: 'athlete', preferredLocale: 'en' };
    state.patch.mockResolvedValue({ response: { status: 503 } });
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());

    fireEvent.press(view.getByText('Українська'));
    await waitFor(() =>
      expect(view.getByText('Could not save your language. Please try again.')).toBeTruthy(),
    );
    expect(state.patch).toHaveBeenCalledWith('/users/me/preferences', {
      body: { preferredLocale: 'uk' },
    });
    expect(view.getByText('My profile')).toBeTruthy();
    expect(state.setItem).not.toHaveBeenCalled();
  });

  it('persists a confirmed account language after successful PATCH', async () => {
    state.account = { id: 'athlete', preferredLocale: 'en' };
    state.patch.mockResolvedValue({
      response: { status: 200 },
      data: { preferredLocale: 'uk' },
    });
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());
    fireEvent.press(view.getByText('Українська'));
    await waitFor(() => expect(view.getByText('Мій профіль')).toBeTruthy());
    expect(state.patch).toHaveBeenCalledTimes(1);
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
  });

  it('rejects a 200 response that did not persist the requested language', async () => {
    state.account = { id: 'athlete', preferredLocale: 'en' };
    state.patch.mockResolvedValue({
      response: { status: 200 },
      data: { preferredLocale: 'en' },
    });
    const view = await renderPicker();
    await waitFor(() => expect(view.getByText('My profile')).toBeTruthy());

    fireEvent.press(view.getByText('Українська'));
    await waitFor(() =>
      expect(view.getByText('Could not save your language. Please try again.')).toBeTruthy(),
    );
    expect(view.getByText('My profile')).toBeTruthy();
    expect(state.setItem).not.toHaveBeenCalled();
  });

  it('applies verified account language over the previous guest preference', async () => {
    state.account = { id: 'athlete', preferredLocale: 'uk' };
    state.getItem.mockResolvedValue('en');
    const view = await renderPicker(true);
    await waitFor(() => expect(view.getByText('Мій профіль')).toBeTruthy());
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
  });
  it('a late storage read cannot replace an explicitly selected language', async () => {
    let completeRead: (value: string | null) => void = () => undefined;
    state.getItem.mockImplementation(
      () => new Promise((resolve) => {
        completeRead = resolve;
      }),
    );
    const view = await renderPicker();
    expect(view.getByText('My profile')).toBeTruthy();
    fireEvent.press(view.getByText('Українська'));
    await waitFor(() => expect(view.getByText('Мій профіль')).toBeTruthy());

    await act(async () => {
      completeRead('en');
    });
    expect(view.getByText('Мій профіль')).toBeTruthy();
    expect(state.setItem).toHaveBeenCalledWith('gym-platform:preferred-locale', 'uk');
  });

});
