# OVRANTO typography — implementation baseline

The approved OVRANTO direction uses **Manrope**. This stage adopts it in **Athlete Web** only; other applications receive app-specific migrations after review. Full typography scales and responsive screen redesign are separate work tracked by #383, #384 and #391.

## Athlete Web

- Load Manrope once in `apps/web/src/app/layout.tsx` via `next/font/google` with `latin`, `cyrillic` and `cyrillic-ext` subsets for English and Ukrainian (including Ґ, Є, І, Ї).
- Use `display: 'swap'`; let Next.js serve optimized font assets instead of adding runtime Google Fonts stylesheet requests or committing font binaries.
- The font variable `--font-manrope` is mapped to Tailwind's `font-sans` in `apps/web/src/app/globals.css`, with a system font fallback. No direct brand font overrides should be required in each component.
- `BrandLogo` continues to render the SVG **mark** as a decorative graphic and the **OVRANTO** wordmark as real HTML text, inheriting the app font. A page's meaningful `h1` is separate from the shared site header.

## QA when migrating screens

Verify Ukrainian/English strings, Light/Dark, narrow screens, zoom at 200%, browser font fallback, long button/field labels and no clipping. Prefer responsive font sizes, readable line-height and semantic HTML headings; avoid fixed-height text controls that truncate on zoom.

## Boundaries

No workspace/package renaming, no SVG wordmark replacement, no API/i18n/backend changes and no claim that other apps have migrated. A production build needs network access to resolve Google Fonts at build time; check CI and generated self-hosted assets before merging.
