import type { Locale } from './index';

/** Import only one catalog in server request boundaries (no eager cross-locale import). */
export async function getMessagesAsync(locale: Locale) {
  return locale === 'en'
    ? (await import('./messages/en.json')).default
    : (await import('./messages/uk.json')).default;
}
