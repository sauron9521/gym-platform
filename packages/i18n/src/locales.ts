/** Single source of truth for supported UI locales. */
export const supportedLocales = ['uk', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'uk';

export function isLocale(value: unknown): value is Locale {
  return value === 'uk' || value === 'en';
}
