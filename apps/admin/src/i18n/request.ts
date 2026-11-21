import { getMessagesAsync } from '@gym/i18n/async';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { resolveRequestLocale } from './resolve-request-locale';

export default getRequestConfig(async () => {
  const preference = (await cookies()).get('gym-locale')?.value;
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveRequestLocale(preference, acceptLanguage);
  return { locale, messages: await getMessagesAsync(locale) };
});
