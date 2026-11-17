import { defaultLocale, getMessages } from '@gym/i18n';
import { getRequestConfig } from 'next-intl/server';

/** Stage 1: keep existing Ukrainian URLs and SEO unchanged. */
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: getMessages(defaultLocale),
}));
