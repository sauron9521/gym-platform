import { getMessages, resolveLocale } from '@gym/i18n';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

/** Cookie is the explicit visitor preference; otherwise use browser language. */
export default getRequestConfig(async () => {
  const preference = (await cookies()).get('gym-locale')?.value;
  const acceptLanguage = (await headers()).get('accept-language')?.split(',')[0];
  const locale = resolveLocale(preference ?? acceptLanguage);
  return { locale, messages: getMessages(locale) };
});
