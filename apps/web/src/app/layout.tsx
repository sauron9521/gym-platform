import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { WebQueryProvider } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gym Platform',
  description: 'Gym Platform web application.',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <WebQueryProvider>{children}</WebQueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
