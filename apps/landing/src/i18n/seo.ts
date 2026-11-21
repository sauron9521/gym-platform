import type { Locale } from '@gym/i18n';
import type { Metadata } from 'next';

import { getSiteOrigin, isIndexingEnabled, siteDescription } from '../shared/lib/seo';

const publicationEnabled = () => process.env.LANDING_ENABLE_I18N_ROUTES === 'true';

/**
 * Only the homepage is translated into both languages. Other pages currently
 * exist in Ukrainian only. Locale routes enforce 404 as well.
 */
export function localizedMetadata({
  locale,
  path = '/',
  title,
  description,
  englishReady,
}: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  englishReady: boolean;
}): Metadata {
  const origin = getSiteOrigin();
  const published = publicationEnabled() && (locale === 'uk' || englishReady);
  const suffix = path === '/' ? '' : path;
  const url = origin && published ? new URL('/' + locale + suffix, origin).toString() : undefined;
  const languages =
    origin && published && englishReady
      ? {
          uk: new URL('/uk' + suffix, origin).toString(),
          en: new URL('/en' + suffix, origin).toString(),
        }
      : undefined;
  const canIndex = published && isIndexingEnabled();

  return {
    title: path === '/' ? { absolute: title } : title,
    description,
    alternates: url ? { canonical: url, ...(languages ? { languages } : {}) } : undefined,
    openGraph: {
      type: 'website',
      locale: locale === 'uk' ? 'uk_UA' : 'en_US',
      siteName: 'Gym Platform',
      title,
      description,
      url,
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
    robots: {
      index: canIndex,
      follow: canIndex,
    },
  };
}

/** Preserve each existing Ukrainian page's specific title and description. */
export function localizedPageMetadata({
  path,
  locale,
  original,
}: {
  path: string;
  locale: Locale;
  original: Metadata;
}): Metadata {
  return localizedMetadata({
    locale,
    path,
    title: typeof original.title === 'string' ? original.title : 'Gym Platform',
    description: typeof original.description === 'string' ? original.description : siteDescription,
    englishReady: false,
  });
}
