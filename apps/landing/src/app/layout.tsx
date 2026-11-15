import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getSiteOrigin, siteDescription } from '@/shared/lib/seo';
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
  },
  robots: {
    index: Boolean(origin),
    follow: Boolean(origin),
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="uk">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
        >
          Перейти до вмісту
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
