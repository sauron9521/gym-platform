import { isLocale, type Locale } from '@gym/i18n';
import { notFound } from 'next/navigation';

export function requirePublishedLocale(value: string, englishReady: boolean): Locale {
  if (
    process.env.LANDING_ENABLE_I18N_ROUTES !== 'true' ||
    !isLocale(value) ||
    (value === 'en' && !englishReady)
  )
    notFound();
  return value;
}
