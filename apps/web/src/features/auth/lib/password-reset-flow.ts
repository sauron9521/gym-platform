/** Client-only hints; NestJS remains authoritative for validation and recovery. */
type PasswordResetValidationMessages = {
  tooShort: string;
  whitespaceOnly: string;
  mismatch: string;
};

const defaultValidationMessages: PasswordResetValidationMessages = {
  tooShort: 'Новий пароль має містити щонайменше 8 символів.',
  whitespaceOnly: 'Пароль не може складатися лише з пробілів.',
  mismatch: 'Паролі не збігаються.',
};

export function validatePasswordResetInput(
  password: string,
  confirmation: string,
  messages: PasswordResetValidationMessages = defaultValidationMessages,
): string | null {
  if (password.length < 8) return messages.tooShort;
  if (!/\S/.test(password)) return messages.whitespaceOnly;
  if (password !== confirmation) return messages.mismatch;
  return null;
}

/** The server validates and consumes an opaque, one-time reset token. */
export function getPasswordResetToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048 ? value : null;
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

/** Localized messages are selected by safe HTTP status, not response bodies. */
export function getForgotPasswordErrorKey(status: number) {
  switch (status) {
    case 400:
      return 'forgotBadInput' as const;
    case 403:
      return 'forgotSecurity' as const;
    case 429:
      return 'forgotRateLimited' as const;
    default:
      return 'forgotUnknown' as const;
  }
}

export function getResetPasswordErrorKey(status: number) {
  switch (status) {
    case 400:
      return 'resetBadInput' as const;
    case 403:
      return 'resetSecurity' as const;
    case 429:
      return 'resetRateLimited' as const;
    default:
      return 'resetUnknown' as const;
  }
}
