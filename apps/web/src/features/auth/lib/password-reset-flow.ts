/** Client-only hints; NestJS remains authoritative for validation and recovery. */
export function validatePasswordResetInput(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < 8) return 'Новий пароль має містити щонайменше 8 символів.';
  if (!/\S/.test(password)) return 'Пароль не може складатися лише з пробілів.';
  if (password !== confirmation) return 'Паролі не збігаються.';
  return null;
}

/** The server validates and consumes an opaque, one-time reset token. */
export function getPasswordResetToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
    ? value
    : null;
}

/** Never reveal account existence or raw upstream response bodies. */
export function getForgotPasswordErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Перевірте правильність електронної адреси.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.';
    case 429:
      return 'Забагато запитів. Спробуйте трохи пізніше.';
    default:
      return 'Не вдалося надіслати запит. Спробуйте пізніше.';
  }
}

export function getResetPasswordErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Посилання недійсне або прострочене, або пароль не відповідає вимогам.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.';
    case 429:
      return 'Забагато спроб. Спробуйте трохи пізніше.';
    default:
      return 'Не вдалося змінити пароль. Спробуйте пізніше.';
  }
}
