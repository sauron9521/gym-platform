import { getMessages, resolveRequestLocale } from '@gym/i18n';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const locale = resolveRequestLocale(
    cookieStore.get('gym-locale')?.value,
    requestHeaders.get('accept-language'),
  );

  return { locale, messages: getMessages(locale) };
});
