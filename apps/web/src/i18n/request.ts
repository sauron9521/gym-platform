import { getMessages } from '@gym/i18n';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { resolveRequestLocale } from './resolve-request-locale';

/** Cookie is the explicit visitor preference; otherwise use browser language. */
export default getRequestConfig(async () => {
  const preference = (await cookies()).get('gym-locale')?.value;
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveRequestLocale(preference, acceptLanguage);
  return { locale, messages: getMessages(locale) };
});
