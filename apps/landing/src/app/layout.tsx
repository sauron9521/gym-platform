import { getMessages as getSharedMessages, defaultLocale, type Locale } from '@gym/i18n';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';

import { getSiteOrigin, isIndexingEnabled, siteDescription, siteName } from '@/shared/lib/seo';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/shared/lib/theme-preference';
import { SiteFooter } from '@/widgets/layout/ui/site-footer';
import { SiteHeader } from '@/widgets/layout/ui/site-header';

import './globals.css';

/** OVRANTO brand type: optimized/self-hosted by Next for UA and EN glyphs. */
const manrope = Manrope({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  display: 'swap',
  variable: '--font-manrope',
});

const origin = getSiteOrigin();

export const metadata: Metadata = {
  metadataBase: origin ? new URL(origin) : undefined,
  title: {
    default: 'OVRANTO — тренування та прогрес',
    template: '%s | OVRANTO',
  },
  description: siteDescription,
  alternates: origin ? { canonical: origin } : undefined,
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName,
    title: 'OVRANTO — тренування та прогрес',
    description: siteDescription,
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OVRANTO — тренування та прогрес',
    description: siteDescription,
    images: ['/opengraph-image'],
  },
  robots: {
    index: isIndexingEnabled(),
    follow: isIndexingEnabled(),
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages, cookieStore] = await Promise.all([
    getLocale(),
    getMessages(),
    cookies(),
  ]);
  const initialTheme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const siteLocale: Locale = locale === 'en' ? 'en' : defaultLocale;
  const skipToContent = getSharedMessages(siteLocale).landing.shell.skipToContent;
  return (
    <html lang={locale} className={initialTheme === 'system' ? undefined : initialTheme}>
      <body className={`${manrope.variable} flex min-h-screen flex-col font-sans`}>
        <a
          href="#main-content"
          className="sr-only rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
        >
          {skipToContent}
        </a>
        {origin ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: siteName,
                url: origin,
                logo: new URL('/icon.svg', origin).toString(),
              }).replaceAll('<', '\\u003c'),
            }}
          />
        ) : null}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader locale={siteLocale} initialTheme={initialTheme} />
          {children}
          <SiteFooter locale={siteLocale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
