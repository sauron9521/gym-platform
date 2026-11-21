import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';

import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'OVRANTO Admin',
  description: 'Закрита адміністративна консоль OVRANTO.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages, cookieStore, t] = await Promise.all([
    getLocale(),
    getMessages(),
    cookies(),
    getTranslations('admin'),
  ]);
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <html lang={locale} className={theme === 'system' ? undefined : theme}>
      <body className={`${manrope.variable} min-h-screen bg-background font-sans text-foreground`}>
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
