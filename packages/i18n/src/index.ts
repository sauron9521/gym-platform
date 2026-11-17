import en from './messages/en.json';
import uk from './messages/uk.json';

/** Source of truth for platform-supported user-facing languages. */
export const supportedLocales = ['uk', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'uk';

const catalogs = { uk, en } satisfies Record<Locale, typeof uk>;

export function isLocale(value: unknown): value is Locale {
  return value === 'uk' || value === 'en';
}

/** Accept language tags like 'en-US' and 'uk_UA'; do not trust arbitrary API input. */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== 'string') return defaultLocale;
  const language = value.toLowerCase().replaceAll('_', '-').split('-')[0];
  return isLocale(language) ? language : defaultLocale;
}

export function getMessages(locale: Locale) {
  return catalogs[locale];
}

/** FormatJS/react-intl uses dotted message IDs; next-intl uses nested objects. */
export function getFlatMessages(locale: Locale): Record<string, string> {
  const result: Record<string, string> = {};
  function visit(node: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(node)) {
      const id = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') result[id] = value;
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        visit(value as Record<string, unknown>, id);
      }
    }
  }
  visit(catalogs[locale]);
  return result;
}

export { resolveRequestLocale } from './request-locale';

export type { TranslationKey } from './typed';

export { apiErrorMessage, validationIssueMessage } from './error-messages';
