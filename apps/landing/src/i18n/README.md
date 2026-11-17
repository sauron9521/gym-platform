# Landing locale rollout

Stage 1 adds next-intl request config and server/client providers while maintaining **Ukrainian-only** public URLs and metadata. Do not advertise `/en` or emit hreflang until all page text, navigation and metadata are translated and route-level locale layouts are implemented.

Existing Landing PR #210 introduces an independent draft dictionary. Consolidate it into `@gym/i18n` when merging; do not maintain duplicate catalogs.

Stage 2, in a separate PR after Landing page redesign/content changes merge:
- Introduce `[locale]` routes + Next 16 `proxy.ts` with explicit locale prefix
- Move all public routes into locale layouts with correct `html[lang]`
- Translate complete page content/SEO metadata, preserve canonical/robots policy
- Generate locale-specific sitemap/hreflang links and E2E tests
