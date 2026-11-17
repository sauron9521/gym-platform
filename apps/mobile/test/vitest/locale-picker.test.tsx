import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useIntl } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

import { LocalePicker } from '@/shared/i18n/locale-picker';
import { LocaleProvider } from '@/shared/i18n/locale-provider';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

function TranslatedHeading() {
  const intl = useIntl();
  return <Text>{intl.formatMessage({ id: 'mobile.profile.myProfile' })}</Text>;
}

describe('Mobile locale provider and picker (React Native)', () => {
  it('initializes from the device locale and renders English FormatJS messages', async () => {
    const view = await render(
      <LocaleProvider>
        <TranslatedHeading />
        <LocalePicker />
      </LocaleProvider>,
    );

    expect(view.getByText('My profile')).toBeTruthy();
    expect(view.getByText('English')).toBeTruthy();
  });

  it('updates translations after choosing Ukrainian and can switch back to English', async () => {
    const view = await render(
      <LocaleProvider>
        <TranslatedHeading />
        <LocalePicker />
      </LocaleProvider>,
    );

    await fireEvent.press(view.getByText('Українська'));
    expect(view.getByText('Мій профіль')).toBeTruthy();

    await fireEvent.press(view.getByText('English'));
    expect(view.getByText('My profile')).toBeTruthy();
  });
});
