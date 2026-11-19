/** Localize based on safe HTTP status, never an untrusted response body. */
export type LoginErrorKey = 'badInput' | 'invalidCredentials' | 'security' | 'rateLimited' | 'unknown';

export function getLoginErrorKey(status: number): LoginErrorKey {
  switch (status) {
    case 400:
      return 'badInput';
    case 401:
      return 'invalidCredentials';
    case 403:
      return 'security';
    case 429:
      return 'rateLimited';
    default:
      return 'unknown';
  }
}

const defaultMessages: Record<LoginErrorKey, string> = {
  badInput: 'Перевірте адресу електронної пошти та пароль.',
  invalidCredentials: 'Невірна електронна пошта або пароль.',
  security: 'Запит заблоковано налаштуваннями безпеки. Перевірте origin вебзастосунку.',
  rateLimited: 'Забагато спроб входу. Спробуйте пізніше.',
  unknown: 'Не вдалося увійти. Спробуйте ще раз.',
};

export function getLoginErrorMessage(status: number): string {
  return defaultMessages[getLoginErrorKey(status)];
}

export type SessionDecision = 'authenticated' | 'unauthenticated' | 'forbidden' | 'error';

export function classifySessionCheck(status: number, hasUser: boolean): SessionDecision {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 200 && hasUser) return 'authenticated';
  return 'error';
}
