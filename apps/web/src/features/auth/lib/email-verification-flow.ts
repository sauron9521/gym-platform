/** Status-only UI decisions: never display untrusted backend error payloads. */
export function getVerificationErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Посилання недійсне, уже використане або термін його дії минув.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.';
    case 429:
      return 'Забагато спроб. Спробуйте трохи пізніше.';
    default:
      return 'Не вдалося підтвердити адресу. Спробуйте пізніше.';
  }
}

export function getResendErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Увійдіть в обліковий запис, щоб повторно надіслати лист.';
    case 403:
      return 'Запит заблоковано налаштуваннями безпеки. Перевірте адресу застосунку.';
    case 409:
      return 'Ця електронна адреса вже підтверджена.';
    case 429:
      return 'Забагато запитів. Спробуйте трохи пізніше.';
    case 503:
      return 'Поштовий сервіс тимчасово недоступний. Спробуйте пізніше.';
    default:
      return 'Не вдалося надіслати лист. Спробуйте ще раз.';
  }
}

/** Avoid passing malformed and arbitrarily long tokens to the API. */
export function getVerificationToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
    ? value
    : null;
}
