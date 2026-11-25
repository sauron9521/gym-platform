import { getFlatMessages, type Locale } from '@gym/i18n';

// Mobile-specific messages extend the shared catalog without modifying other apps.
const authErrors = {
  invalidCredentials: {
    uk: 'Невірна електронна адреса або пароль.',
    en: 'Incorrect email address or password.',
  },
  invalidRequest: {
    uk: 'Перевірте електронну адресу та пароль.',
    en: 'Check your email address and password.',
  },
  accessDenied: {
    uk: 'Доступ заборонено.',
    en: 'Access denied.',
  },
  throttled: {
    uk: 'Забагато спроб входу. Спробуйте пізніше.',
    en: 'Too many sign-in attempts. Try again later.',
  },
  connectionFailed: {
    uk: 'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
    en: 'Could not connect to the server. Try again.',
  },
  storageFailed: {
    uk: 'Не вдалося захищено зберегти сесію на пристрої.',
    en: 'Could not securely store your session on this device.',
  },
  verificationFailed: {
    uk: 'Не вдалося підтвердити вхід.',
    en: 'Could not verify your sign-in.',
  },
  sessionExpired: {
    uk: 'Сесія потребує повторного входу.',
    en: 'Sign in again to restore your session.',
  },
  apiUnavailable: {
    uk: 'Не вдалося підключитися до сервера.',
    en: 'The server is unavailable.',
  },
  sessionChanged: {
    uk: 'Сесія змінилася. Спробуйте ще раз.',
    en: 'Your session changed. Try again.',
  },
  sessionVerificationFailed: {
    uk: 'Не вдалося підтвердити сесію.',
    en: 'Could not verify your session.',
  },
  restoring: {
    uk: 'Зачекайте на перевірку сесії.',
    en: 'Wait for your session to be verified.',
  },
  permissionsFailed: {
    uk: 'Не вдалося перевірити права доступу.',
    en: 'Could not verify account permissions.',
  },
  mobileAccessDenied: {
    uk: 'Цей акаунт не має доступу до мобільного застосунку.',
    en: 'This account does not have access to the mobile app.',
  },
} satisfies Record<string, Record<Locale, string>>;

export type MobileAuthErrorCode =
  keyof typeof authErrors | 'failed' | 'invalidEmail' | 'invalidPassword';

/** Only allow known message IDs; unknown codes must never be rendered as raw text. */
export function getMobileAuthErrorMessageId(code: string): string {
  const known =
    Object.hasOwn(authErrors, code) ||
    code === 'invalidEmail' ||
    code === 'invalidPassword' ||
    code === 'failed';
  return `mobile.signIn.${known ? code : 'failed'}`;
}

const navigationMessages = {
  'mobile.tabs.progress': { uk: 'Прогрес', en: 'Progress' },
  'mobile.navigation.editProfile': { uk: 'Редагувати профіль', en: 'Edit profile' },
  'mobile.navigation.exercises': { uk: 'Вправи', en: 'Exercises' },
  'mobile.navigation.workout': { uk: 'Тренування', en: 'Workout' },
  'mobile.navigation.exerciseProgress': { uk: 'Прогрес вправи', en: 'Exercise progress' },
  'mobile.navigation.program': { uk: 'Програма', en: 'Program' },
  'mobile.navigation.newWorkout': { uk: 'Нове тренування', en: 'New workout' },
  'mobile.navigation.athletes': { uk: 'Мої підопічні', en: 'My athletes' },
  'mobile.navigation.restoring': { uk: 'Відновлення сесії', en: 'Restoring session' },
} satisfies Record<string, Record<Locale, string>>;

export function getMobileMessages(locale: Locale): Record<string, string> {
  return {
    ...getFlatMessages(locale),
    ...Object.fromEntries(
      Object.entries(navigationMessages).map(([id, messages]) => [id, messages[locale]]),
    ),
    ...Object.fromEntries(
      Object.entries(authErrors).map(([code, translations]) => [
        getMobileAuthErrorMessageId(code),
        translations[locale],
      ]),
    ),
  };
}
