import { defaultLocale, getMessages, isLocale } from '@gym/i18n';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    process.env.LANDING_ENABLE_I18N_ROUTES === 'true' && isLocale(requested)
      ? requested
      : defaultLocale;
  return { locale, messages: getMessages(locale) };
});
