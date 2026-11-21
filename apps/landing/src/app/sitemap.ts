import type { MetadataRoute } from 'next';
import { publicRoutes } from '../shared/config/navigation';
import { isEnglishPageReady } from '../i18n/published-pages';
import { getSiteOrigin, isIndexingEnabled } from '../shared/lib/seo';

/** Only publish language alternates when both variants actually exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  if (!origin || !isIndexingEnabled()) return [];
  if (process.env.LANDING_ENABLE_I18N_ROUTES !== 'true') {
    return publicRoutes.map((path) => ({ url: new URL(path, origin).toString() }));
  }
  return [
    {
      url: new URL('/uk', origin).toString(),
      alternates: {
        languages: { uk: new URL('/uk', origin).toString(), en: new URL('/en', origin).toString() },
      },
    },
    {
      url: new URL('/en', origin).toString(),
      alternates: {
        languages: { uk: new URL('/uk', origin).toString(), en: new URL('/en', origin).toString() },
      },
    },
    ...publicRoutes
      .filter((path) => path !== '/')
      .flatMap((path) => {
        const ukrainianUrl = new URL('/uk' + path, origin).toString();
        if (!isEnglishPageReady(path)) {
          return [{ url: ukrainianUrl }];
        }
        const englishUrl = new URL('/en' + path, origin).toString();
        const languages = { uk: ukrainianUrl, en: englishUrl };
        return [
          { url: ukrainianUrl, alternates: { languages } },
          { url: englishUrl, alternates: { languages } },
        ];
      }),
  ];
}
