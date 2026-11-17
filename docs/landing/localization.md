# Landing localization — stage 1 (safe foundation)

This PR introduces a typed Ukrainian/English message catalog and parity test.
Public routes remain Ukrainian and the document root keeps `lang="uk"`.
**This PR does not claim English pages are live.**

## Stage 2 (after product pages settle)
1. Move Ukrainian routes into an internal route group without changing existing public paths.
2. Create an English root layout with `<html lang="en">` and /en route counterparts.
3. Add a language switch, translated pages, hreflang/canonical and localized sitemap.
4. Test correct document language, complete English content and navigation in Chromium.

The route migration belongs after Homepage, Features and audience PRs merge
so it does not conflict with those page files. A runtime i18n package can
be considered only if routing and interpolation require it.
