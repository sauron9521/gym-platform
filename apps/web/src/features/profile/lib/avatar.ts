export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const keyIdParts = [
  '[0-9a-f]{8}',
  '[0-9a-f]{4}',
  '[1-8][0-9a-f]{3}',
  '[89ab][0-9a-f]{3}',
  '[0-9a-f]{12}',
];
const avatarPath = new RegExp(`^/avatars/${keyIdParts.join('-')}\\.(png|jpg|webp)$`);

export function validateAvatarFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (file.size === 0) return 'Оберіть непорожній файл.';
  if (file.size > MAX_AVATAR_BYTES) return 'Максимальний розмір фотографії — 2 МіБ.';
  if (!acceptedTypes.has(file.type)) return 'Дозволено лише PNG, JPEG або WebP.';
  return null;
}

/** Never load arbitrary URLs from mutable profile data. */
export function getAvatarSource(value: string | null | undefined): string | null {
  if (!value || !avatarPath.test(value)) return null;
  const extension = value.split('.').at(-1);
  if (extension === 'jpg' || extension === 'png' || extension === 'webp') {
    return `/backend${value}`;
  }
  return null;
}

export function getAvatarInitials(displayName: string, email: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]).join('');
  return (letters || email.charAt(0) || '?').toUpperCase();
}

export function avatarErrorMessage(status: number): string {
  if (status === 400 || status === 413 || status === 422) {
    return 'Не вдалося обробити фотографію. Перевірте формат і розмір.';
  }
  if (status === 401) return 'Сесію завершено. Увійдіть повторно.';
  if (status === 403) return 'Недостатньо прав для цієї дії.';
  if (status === 429) return 'Забагато спроб. Спробуйте пізніше.';
  return 'Не вдалося змінити аватар. Спробуйте пізніше.';
}
