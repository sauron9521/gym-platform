import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { getLocale, getMessages } from 'next-intl/server';

import {
  parseThemePreference,
  THEME_COOKIE_NAME,
} from '@/shared/lib/theme-preference';

import { WebQueryProvider } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gym Platform',
  description: 'Gym Platform web application.',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages, cookieStore] = await Promise.all([getLocale(), getMessages(), cookies()]);
  const preference = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  return (
    <html lang={locale} className={preference === 'system' ? undefined : preference}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <WebQueryProvider>{children}</WebQueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
