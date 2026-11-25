import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Locale } from '@gym/i18n';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/features/auth/model/auth-context';
import { SignInScreen } from '@/screens/sign-in/ui/sign-in-screen';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));

const signIn = vi.fn();
const retryVerification = vi.fn();

function renderScreen(locale: Locale, recoveryAvailable = false) {
  vi.mocked(useAuth).mockReturnValue({
    signIn,
    retryVerification,
    recoveryAvailable,
  } as unknown as ReturnType<typeof useAuth>);
  return render(
    <IntlProvider locale={locale} defaultLocale="uk" messages={getMobileMessages(locale)}>
      <SignInScreen />
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  signIn.mockResolvedValue({ success: true });
  retryVerification.mockResolvedValue({ success: true });
});
afterEach(async () => {
  await cleanup();
});

describe('native sign-in uk/en localization without changing auth behavior', () => {
  it.each([
    {
      locale: 'uk' as const,
      welcome: 'З поверненням!',
      email: 'Електронна пошта',
      password: 'Пароль',
      placeholder: 'Введіть пароль',
      action: 'Увійти',
      note: 'На iOS та Android сесія зберігається захищено. У браузері вхід тимчасовий.',
      recovery: 'Відновити сесію',
      retryA11y: 'Повторити перевірку сесії',
    },
    {
      locale: 'en' as const,
      welcome: 'Welcome back!',
      email: 'Email address',
      password: 'Password',
      placeholder: 'Enter password',
      action: 'Sign in',
      note: 'On iOS and Android, your session is stored securely. Browser sign-in is temporary.',
      recovery: 'Restore session',
      retryA11y: 'Retry session verification',
    },
  ])('shows $locale copy and accessible controls including recovery', async (copy) => {
    const view = await renderScreen(copy.locale, true);
    expect(view.getByText('OVRANTO')).toBeTruthy();
    expect(view.getByText(copy.welcome)).toBeTruthy();
    expect(view.getByText(copy.note)).toBeTruthy();
    expect(view.getByText(copy.email)).toBeTruthy();
    expect(view.getByText(copy.password)).toBeTruthy();
    expect(view.getByTestId('sign-in-email').props.accessibilityLabel).toBe(copy.email);
    expect(view.getByTestId('sign-in-password').props.accessibilityLabel).toBe(copy.password);
    expect(view.getByTestId('sign-in-password').props.placeholder).toBe(copy.placeholder);
    expect(view.getByText(copy.action)).toBeTruthy();
    expect(view.getByText(copy.recovery)).toBeTruthy();
    expect(view.getByLabelText(copy.retryA11y)).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(retryVerification).not.toHaveBeenCalled();
  });

  it('does not show recovery action without a recoverable session', async () => {
    const view = await renderScreen('en');
    expect(view.queryByText('Restore session')).toBeNull();
  });

  it.each([
    {
      locale: 'uk' as const,
      action: 'Увійти',
      invalidEmail: 'Вкажіть коректну електронну адресу.',
      invalidPassword: 'Вкажіть пароль.',
    },
    {
      locale: 'en' as const,
      action: 'Sign in',
      invalidEmail: 'Enter a valid email address.',
      invalidPassword: 'Enter your password.',
    },
  ])('validates credentials in $locale with the original Zod resolver', async (copy) => {
    const view = await renderScreen(copy.locale);
    await fireEvent.press(view.getByText(copy.action));
    await waitFor(() => {
      expect(view.getByText(copy.invalidEmail)).toBeTruthy();
      expect(view.getByText(copy.invalidPassword)).toBeTruthy();
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('submits the exact password once and does not alter token or auth flow', async () => {
    const view = await renderScreen('en');
    await fireEvent.changeText(view.getByTestId('sign-in-email'), ' athlete@example.test ');
    await fireEvent.changeText(view.getByTestId('sign-in-password'), '  secret pass  ');
    await fireEvent.press(view.getByText('Sign in'));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('athlete@example.test', '  secret pass  '),
    );
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('shows a localized safe error after an unexpected sign-in exception', async () => {
    signIn.mockRejectedValueOnce(new Error('SECRET_HTTP_BODY'));
    const view = await renderScreen('en');
    await fireEvent.changeText(view.getByTestId('sign-in-email'), 'athlete@example.test');
    await fireEvent.changeText(view.getByTestId('sign-in-password'), 'secret');
    await fireEvent.press(view.getByText('Sign in'));
    await waitFor(() => expect(view.getByText('Could not sign in. Try again.')).toBeTruthy());
    expect(view.queryByText('SECRET_HTTP_BODY')).toBeNull();
  });

  it('uses the existing recovery callback and preserves the explicit retry label', async () => {
    const view = await renderScreen('en', true);
    await fireEvent.press(view.getByLabelText('Retry session verification'));
    await waitFor(() => expect(retryVerification).toHaveBeenCalledTimes(1));
    expect(signIn).not.toHaveBeenCalled();
  });
  it('disables sign-in and recovery while checking a session, then handles rejection safely', async () => {
    let rejectRecovery: (error: Error) => void = () => undefined;
    retryVerification.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRecovery = reject;
        }),
    );
    const view = await renderScreen('en', true);
    await fireEvent.press(view.getByLabelText('Retry session verification'));
    await waitFor(() => {
      expect(view.getByTestId('sign-in-email').props.editable).toBe(false);
      expect(view.getByTestId('sign-in-password').props.editable).toBe(false);
      expect(
        view.getByRole('button', { name: 'Retry session verification' }).props.accessibilityState
          .disabled,
      ).toBe(true);
    });
    await fireEvent.press(view.getByRole('button', { name: 'Retry session verification' }));
    await fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
    expect(retryVerification).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    await act(async () => rejectRecovery(new Error('SECRET_RECOVERY_RESPONSE')));
    await waitFor(() => {
      expect(view.getByText('Could not sign in. Try again.')).toBeTruthy();
      expect(view.getByTestId('sign-in-email').props.editable).toBe(true);
    });
    expect(view.queryByText('SECRET_RECOVERY_RESPONSE')).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });
  it.each([
    ['uk', 'Увійти', 'Невірна електронна адреса або пароль.'],
    ['en', 'Sign in', 'Incorrect email address or password.'],
  ] as const)('localizes credential failure in %s', async (locale, action, message) => {
    signIn.mockResolvedValueOnce({ success: false, code: 'invalidCredentials' });
    const view = await renderScreen(locale);
    await fireEvent.changeText(view.getByTestId('sign-in-email'), 'athlete@example.test');
    await fireEvent.changeText(view.getByTestId('sign-in-password'), 'secret');
    await fireEvent.press(view.getByText(action));
    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['uk', 'Повторити перевірку сесії', 'Сесія потребує повторного входу.'],
    ['en', 'Retry session verification', 'Sign in again to restore your session.'],
  ] as const)('localizes recovery failure in %s', async (locale, action, message) => {
    retryVerification.mockResolvedValueOnce({ success: false, code: 'sessionExpired' });
    const view = await renderScreen(locale, true);
    await fireEvent.press(view.getByLabelText(action));
    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    expect(retryVerification).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('uses a safe generic message for an unexpected error code', async () => {
    retryVerification.mockResolvedValueOnce({ success: false, code: 'SECRET_RESPONSE' });
    const view = await renderScreen('en', true);
    await fireEvent.press(view.getByLabelText('Retry session verification'));
    await waitFor(() => expect(view.getByText('Could not sign in. Try again.')).toBeTruthy());
    expect(view.queryByText('SECRET_RESPONSE')).toBeNull();
  });
});
