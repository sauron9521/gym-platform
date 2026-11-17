import type { Metadata } from 'next';

const siteName = 'Gym Platform';

export const siteDescription =
  'Gym Platform — екосистема для спортсменів і тренерів: програми тренувань, бібліотека вправ та відстеження прогресу.';

/**
 * No canonical URLs or public indexing until the real production domain is configured.
 * LANDING_SITE_URL must be an HTTPS origin (for example, https://example.com).
 */
export function getSiteOrigin(): string | null {
  const configured = process.env.LANDING_SITE_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    const url = new URL(configured);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const origin = getSiteOrigin();
  const canonical = origin ? new URL(path, origin).toString() : undefined;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: 'website',
      locale: 'uk_UA',
      siteName,
      title,
      description,
      url: canonical,
    },
  };
}

/** Domain configuration alone never authorizes search-engine indexing. */
export function isIndexingEnabled(): boolean {
  return getSiteOrigin() !== null && process.env.LANDING_ALLOW_INDEXING === 'true';
}
