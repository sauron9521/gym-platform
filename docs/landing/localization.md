# Landing localization rollout

The shared `@gym/i18n` package is the only source of truth for `uk` and `en` messages.
This PR seeds the `landing.home` and `landing.common` keys using current Ukrainian
Landing copy and English equivalents. Common navigation strings and locale helpers
already exist in that package and must not be duplicated.

## Current scope

- Existing public URLs remain Ukrainian only (no `/en` routes).
- `apps/landing/src/i18n/request.ts` continues to provide `uk` to `next-intl`.
- This PR does not enable an English UI, change SEO canonicals, or touch API preferences.
- `packages/i18n/test/catalog.test.mjs` checks bilingual key parity and nonempty values.

## Follow-up implementation (separate PR)

1. Extract remaining live UI copy into `@gym/i18n`, verifying meaning rather than literal translation.
2. Render Landing UI with `next-intl`, keeping rich hero markup and links accessible.
3. Add explicit locale routes and middleware/proxy with a safe strategy for existing Ukrainian URLs.
4. Generate localized metadata, `hreflang`, sitemap and canonical URLs without bypassing indexing opt-in.
5. Run Chromium checks at narrow/wide widths for navigation, `html[lang]`, complete English content and no mixed-language sections.
