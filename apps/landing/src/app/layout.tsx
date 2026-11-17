import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { getSiteOrigin, isIndexingEnabled, siteDescription } from '@/shared/lib/seo';
import { SiteFooter } from '@/widgets/layout/ui/site-footer';
import { SiteHeader } from '@/widgets/layout/ui/site-header';

import './globals.css';

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
  const messages = await getMessages();
  return (
    <html lang="uk">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
        >
          Перейти до вмісту
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
        <NextIntlClientProvider locale="uk" messages={messages}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
