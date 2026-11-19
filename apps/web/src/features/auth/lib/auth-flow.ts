/** UI decisions are based on HTTP status, never on an untrusted error body. */
export function getLoginErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Перевірте адресу електронної пошти та пароль.';
    case 401:
      return 'Невірна електронна пошта або пароль.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте origin вебзастосунку.';
    case 429:
      return 'Забагато спроб входу. Спробуйте пізніше.';
    default:
      return 'Не вдалося увійти. Спробуйте ще раз.';
  }
}

export type SessionDecision = 'authenticated' | 'unauthenticated' | 'forbidden' | 'error';

export function classifySessionCheck(status: number, hasUser: boolean): SessionDecision {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 200 && hasUser) return 'authenticated';
  return 'error';
}

/** Stable translation key derived from HTTP status, never the untrusted response body. */
export function getLoginErrorKey(status: number) {
  switch (status) {
    case 400:
      return 'badInput' as const;
    case 401:
      return 'invalidCredentials' as const;
    case 403:
      return 'security' as const;
    case 429:
      return 'rateLimited' as const;
    default:
      return 'unknown' as const;
  }
}
