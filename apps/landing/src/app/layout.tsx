import { getMessages as getSharedMessages, defaultLocale, type Locale } from '@gym/i18n';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { getSiteOrigin, isIndexingEnabled, siteDescription } from '@/shared/lib/seo';
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
    default: 'Gym Platform — тренування та прогрес',
    template: '%s | Gym Platform',
  },
  description: siteDescription,
  alternates: origin ? { canonical: origin } : undefined,
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'Gym Platform',
    title: 'Gym Platform — тренування та прогрес',
    description: siteDescription,
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gym Platform — тренування та прогрес',
    description: siteDescription,
    images: ['/opengraph-image'],
  },
  robots: {
    index: isIndexingEnabled(),
    follow: isIndexingEnabled(),
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const siteLocale: Locale = locale === 'en' ? 'en' : defaultLocale;
  const skipToContent = getSharedMessages(siteLocale).landing.shell.skipToContent;
  return (
    <html lang={locale}>
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
                name: 'Gym Platform',
                url: origin,
                logo: new URL('/icon.svg', origin).toString(),
              }).replaceAll('<', '\\u003c'),
            }}
          />
        ) : null}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader locale={siteLocale} />
          {children}
          <SiteFooter locale={siteLocale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
