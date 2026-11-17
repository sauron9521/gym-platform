import type { MetadataRoute } from 'next';

import { getSiteOrigin, isIndexingEnabled } from '@/shared/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  if (!origin || !isIndexingEnabled()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', origin).toString(),
  };
}
