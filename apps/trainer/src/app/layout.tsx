import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { getLocale, getMessages } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { TrainerShell } from '@/widgets/trainer-shell/ui/trainer-shell';

import './globals.css';

export const metadata: Metadata = {
  title: 'OVRANTO Trainer',
  description: 'OVRANTO Trainer workspace',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages, cookieStore] = await Promise.all([
    getLocale(),
    getMessages(),
    cookies(),
  ]);
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const copy = getTrainerCopy(locale as Locale);

  return (
    <html lang={locale} className={theme === 'system' ? undefined : theme}>
      <body className="min-h-screen font-sans">
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          {copy.skip}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TrainerShell locale={locale as Locale} initialTheme={theme}>
            {children}
          </TrainerShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
