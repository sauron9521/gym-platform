export function getMobileLoginError(status: number): string {
  switch (status) {
    case 400: return 'Перевірте електронну адресу та пароль.';
    case 401: return 'Невірна електронна адреса або пароль.';
    case 403: return 'Доступ заборонено.';
    case 429: return 'Забагато спроб входу. Спробуйте пізніше.';
    default: return 'Не вдалося увійти. Спробуйте ще раз.';
  }
}

export function validateMobileCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
    return 'Вкажіть коректну електронну адресу.';
  }
  if (!/\S/.test(password)) return 'Вкажіть пароль.';
  return null;
}
