/** Use HTTP status, never an untrusted backend error body. */
export type VerificationEmailStatus = 'SUBMITTED' | 'RETRY_REQUIRED';

export function getRegistrationErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Перевірте електронну пошту та надійність пароля.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.';
    case 409:
      return 'Обліковий запис із цією поштою вже існує.';
    case 429:
      return 'Забагато спроб реєстрації. Спробуйте пізніше.';
    default:
      return 'Не вдалося створити обліковий запис. Спробуйте ще раз.';
  }
}

export function getRegistrationEmailMessage(status: VerificationEmailStatus): string {
  return status === 'SUBMITTED'
    ? 'Запит на надсилання листа підтвердження прийнято. Перевірте пошту та папку «Спам».'
    : 'Обліковий запис створено, але запит на надсилання листа не вдався. Спробуйте повторне надсилання після входу.';
}

/** Public error messages use translated keys, not backend response bodies. */
export function getRegistrationErrorKey(status: number) {
  switch (status) {
    case 400:
      return 'badInput' as const;
    case 403:
      return 'security' as const;
    case 409:
      return 'duplicate' as const;
    case 429:
      return 'rateLimited' as const;
    default:
      return 'unknown' as const;
  }
}

export function getRegistrationEmailKey(status: VerificationEmailStatus) {
  if (status === 'SUBMITTED') return 'submitted' as const;
  return 'retryRequired' as const;
}
