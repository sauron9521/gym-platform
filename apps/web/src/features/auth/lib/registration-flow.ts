/** Pure client-side hints. NestJS remains the source of truth for validation. */
export type VerificationEmailStatus = 'SUBMITTED' | 'RETRY_REQUIRED';

export function validateRegistrationInput(
  email: string,
  password: string,
  confirmation: string,
): string | null {
  if (!email.trim()) return 'Вкажіть електронну пошту.';
  if (password.length < 8) return 'Пароль має містити щонайменше 8 символів.';
  if (password !== confirmation) return 'Паролі не збігаються.';
  return null;
}

/** Use HTTP status, never an untrusted backend error body. */
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
