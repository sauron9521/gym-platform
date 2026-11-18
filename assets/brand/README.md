# OVRANTO — approved brand assets (stage 1)

Source of truth: owner-approved logo screenshot and Gym Platform GitHub Issues
[#390](https://github.com/sauron9521/gym-platform/issues/390),
[#381](https://github.com/sauron9521/gym-platform/issues/381) and
[#393](https://github.com/sauron9521/gym-platform/issues/393).

The icon is **two distinct filled, ascending parallelogram strokes**:
a larger Deep Teal left stroke (`#075C55`) and a smaller Terracotta right
stroke (`#C76537`). The full horizontal lockup uses the **OVRANTO** wordmark
and the smaller **PERFORMANCE PLATFORM** caption. This replaces the earlier
placeholder dumbbell, outline-stroke, letter-A and mountain logo experiments.

- `logo-light.svg`: Full wordmark on light backgrounds.
- `logo-dark.svg`: Full wordmark on dark backgrounds.
- `mark.svg`: Compact colored symbol; source for favicon/native icon preparation.
- `mark-monochrome.svg`: Single-color symbol for constrained contexts; inherits `currentColor`.

Assets are **transparent** and use a common path geometry. They contain no
embedded fonts, scripts or external references. The SVG wordmark remains
selectable text and uses `Manrope, Arial, sans-serif`; rendering can vary if
the font is not loaded or installed.

## Integration requirements

- Use the full lockup where space allows; the symbol alone needs an accessible
  name through the consumer's label or image `alt` text.
- Use `logo-light.svg` on light and `logo-dark.svg` on dark backgrounds;
  **do not** recolor the Terracotta stripe as Teal.
- The logo is not an application state. Terracotta in the logo stays branded
  even though primary buttons remain Deep Teal.
- Prepare raster/adaptive native icons in a **separate PR** after verifying
  platform-safe-area and small-size rendering.
- Do not rename `@gym/*` packages, repository, domains, or native bundle IDs
  as part of adding these assets.
- Commercial use and deployment still need trademark/IP/domain review.
  This PR does **not** establish registration or ownership.

Verify locally with `pnpm test:tooling`
(includes `scripts/brand-assets.test.mjs`).
