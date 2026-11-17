import type { MetadataRoute } from 'next';

import { publicRoutes } from '@/shared/config/navigation';
import { getSiteOrigin, isIndexingEnabled } from '@/shared/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();

  if (!origin || !isIndexingEnabled()) {
    return [];
  }

  return publicRoutes.map((path) => ({
    url: new URL(path, origin).toString(),
  }));
}
