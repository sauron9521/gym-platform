import { defaultLocale, isLocale, type Locale } from './index.js';

/** Explicit choice wins; otherwise use the highest priority supported Accept-Language tag. */
export function resolveRequestLocale(
  explicitLocale: string | null | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(explicitLocale)) return explicitLocale;
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(',')
    .slice(0, 20)
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const qualityParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
      return { tag, quality, index };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of ranked) {
    const language = tag?.split(/[-_]/, 1)[0]?.toLowerCase();
    if (isLocale(language)) return language;
  }
  return defaultLocale;
}
