import { afterEach, describe, expect, it } from 'vitest';

import sitemap from '../src/app/sitemap';
import { localizedMetadata, localizedPageMetadata } from '../src/i18n/seo';
import { publicRoutes } from '../src/shared/config/navigation';

const vars = ['LANDING_SITE_URL', 'LANDING_ALLOW_INDEXING', 'LANDING_ENABLE_I18N_ROUTES'];
const original = Object.fromEntries(vars.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of vars) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const origin = 'https://gym.example.test';

function setOptions({ url = origin, indexing = true, localeRoutes = true } = {}) {
  if (url === null) delete process.env.LANDING_SITE_URL;
  else process.env.LANDING_SITE_URL = url;
  process.env.LANDING_ALLOW_INDEXING = String(indexing);
  process.env.LANDING_ENABLE_I18N_ROUTES = String(localeRoutes);
}

function home(locale) {
  return localizedMetadata({
    locale,
    title: locale === 'en' ? 'Gym Platform — Train smarter' : 'Gym Platform — тренування',
    description: locale === 'en' ? 'English description' : 'Український опис',
    englishReady: true,
  });
}

describe('Landing localized SEO publication', () => {
  it('preserves the legacy sitemap exactly when locale routes are disabled', () => {
    setOptions({ localeRoutes: false });
    const urls = sitemap();
    expect(urls.map(({ url }) => url)).toEqual(
      publicRoutes.map((path) => new URL(path, origin).toString()),
    );
    expect(urls.every((item) => item.alternates === undefined)).toBe(true);

    const metadata = home('en');
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots.index).toBe(false);
    expect(metadata.robots.follow).toBe(false);
  });

  it('publishes only translated locale URLs, excluding all unfinished English routes', () => {
    setOptions();
    const urls = sitemap();
    expect(urls).toHaveLength(publicRoutes.length + 1);

    const expected = [
      origin + '/uk',
      origin + '/en',
      ...publicRoutes.filter((path) => path !== '/').map((path) => origin + '/uk' + path),
    ];
    expect(urls.map(({ url }) => url)).toEqual(expected);
    expect(new Set(urls.map((item) => item.url)).size).toBe(expected.length);
    expect(urls.every(({ url }) => !url.includes('/en/'))).toBe(true);
    expect(urls.every(({ url }) => url !== origin + '/')).toBe(true);
    expect(urls.slice(2).every((item) => item.alternates === undefined)).toBe(true);
  });

  it('gives both homepages reciprocal and identical hreflang pairs', () => {
    setOptions();
    const languages = {
      uk: origin + '/uk',
      en: origin + '/en',
    };
    const sitemapHomes = sitemap().slice(0, 2);
    for (const item of sitemapHomes) {
      expect(item.alternates.languages).toEqual(languages);
    }
    for (const locale of ['uk', 'en']) {
      const seo = home(locale);
      expect(seo.alternates.canonical).toBe(languages[locale]);
      expect(seo.alternates.languages).toEqual(languages);
      expect(seo.robots.index).toBe(true);
      expect(seo.robots.follow).toBe(true);
      expect(seo.title).toEqual({
        absolute: locale === 'uk' ? 'Gym Platform — тренування' : 'Gym Platform — Train smarter',
      });
      expect(seo.openGraph.url).toBe(languages[locale]);
      expect(seo.openGraph.locale).toBe(locale === 'uk' ? 'uk_UA' : 'en_US');
      expect(seo.twitter.description).toBe(
        locale === 'uk' ? 'Український опис' : 'English description',
      );
      expect(seo.twitter.images).toEqual(['/opengraph-image']);
      expect(seo.openGraph.images).toHaveLength(1);
    }
  });

  it('retains route-specific source titles and descriptions on Ukrainian secondary pages', () => {
    setOptions();
    const originalPage = {
      title: 'Можливості',
      description: 'Каталог вправ та програми тренувань.',
    };
    const metadata = localizedPageMetadata({
      path: '/features',
      locale: 'uk',
      original: originalPage,
    });
    expect(metadata.title).toBe(originalPage.title);
    expect(metadata.description).toBe(originalPage.description);
    expect(metadata.alternates.canonical).toBe(origin + '/uk/features');
    expect(metadata.alternates.languages).toBeUndefined();
    expect(metadata.openGraph.locale).toBe('uk_UA');
    expect(metadata.openGraph.description).toBe(originalPage.description);
    expect(metadata.twitter.description).toBe(originalPage.description);
  });

  it('never signals unpublished English secondary pages as indexable or canonical', () => {
    setOptions();
    const unavailable = localizedMetadata({
      locale: 'en',
      path: '/features',
      title: 'Features',
      description: 'Untranslated content',
      englishReady: false,
    });
    expect(unavailable.alternates).toBeUndefined();
    expect(unavailable.robots.index).toBe(false);
    expect(unavailable.robots.follow).toBe(false);
  });

  it('requires valid HTTPS origin and indexing opt-in for sitemap publication', () => {
    for (const options of [
      { url: null },
      { url: 'http://gym.example.test' },
      { url: 'https://gym.example.test/extra' },
      { indexing: false },
    ]) {
      setOptions(options);
      expect(sitemap()).toEqual([]);
      const metadata = home('en');
      expect(metadata.robots.index).toBe(false);
    }
  });

  it('does not expose any language variants when the explicit feature flag is off', () => {
    for (const enabled of [false]) {
      setOptions({ localeRoutes: enabled });
      expect(home('uk').alternates).toBeUndefined();
      expect(home('en').alternates).toBeUndefined();
      expect(sitemap().every(({ url }) => !url.includes('/uk'))).toBe(true);
    }
  });

  it('omits canonical and hreflang without configured domain, even with routes allowed', () => {
    setOptions({ url: null });
    expect(home('en').alternates).toBeUndefined();
    expect(home('en').robots.index).toBe(false);
  });
});
