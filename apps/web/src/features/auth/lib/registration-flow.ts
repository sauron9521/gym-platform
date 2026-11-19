/** Use safe HTTP status, never untrusted backend error text. */
export type VerificationEmailStatus = 'SUBMITTED' | 'RETRY_REQUIRED';

export type RegistrationErrorKey =
  | 'badInput'
  | 'security'
  | 'duplicate'
  | 'rateLimited'
  | 'unknown';

export function getRegistrationErrorKey(status: number): RegistrationErrorKey {
  switch (status) {
    case 400:
      return 'badInput';
    case 403:
      return 'security';
    case 409:
      return 'duplicate';
    case 429:
      return 'rateLimited';
    default:
      return 'unknown';
  }
}

export function getRegistrationEmailKey(status: VerificationEmailStatus) {
  return status === 'SUBMITTED' ? ('submitted' as const) : ('retryRequired' as const);
}

const defaultErrors: Record<RegistrationErrorKey, string> = {
  badInput: 'Перевірте електронну пошту та надійність пароля.',
  security: 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.',
  duplicate: 'Обліковий запис із цією поштою вже існує.',
  rateLimited: 'Забагато спроб реєстрації. Спробуйте пізніше.',
  unknown: 'Не вдалося створити обліковий запис. Спробуйте ще раз.',
};

export function getRegistrationErrorMessage(status: number): string {
  return defaultErrors[getRegistrationErrorKey(status)];
}

export function getRegistrationEmailMessage(status: VerificationEmailStatus): string {
  return status === 'SUBMITTED'
    ? 'Запит на надсилання листа підтвердження прийнято. Перевірте пошту та папку «Спам».'
    : 'Обліковий запис створено, але запит на надсилання листа не вдався. Спробуйте повторне надсилання після входу.';
}
