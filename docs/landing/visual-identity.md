# OVRANTO Landing — Premium Athletic Minimal

## Source of truth

Landing uses the approved OVRANTO design system and **exactly the same semantic CSS palette** as
Web/Admin: @gym/design-tokens/ovranto.css. The legacy Dark Performance stylesheet must not
be imported in Landing. Tailwind v4 utilities map to the CSS semantic variables, rather than
independently hard-coding brand colors or light/dark surfaces.

- Light (default): warm ivory background, charcoal text, Deep Teal primary and Terracotta accent.
- Dark: the same semantic variables honor operating-system dark preference and
  explicit .dark / data-theme=dark overrides. Semantic primary, foreground,
  card, secondary, border and muted variables carry the contrast.
- Logo: shared BrandLogo from @gym/ui-web, using the approved **fixed** teal and
  terracotta SVG strokes and live selectable OVRANTO wordmark; don't fork the SVG
  artwork into Landing-specific React components.
- Favicon: compact two-stroke brand mark in apps/landing/src/app/icon.svg, matching
  approved geometry/colors without the old placeholder dumbbell.
- Type: **Manrope** via Next.js next/font/google (Latin/Cyrillic/Cyrillic-ext),
  served from the app at runtime. It falls back to system fonts; no hosted font stylesheets.
- Layout: shared responsive container and marketing primitives, clear hierarchies,
  soft semantic surfaces, rounded cards and a high-contrast primary CTA.
- All visual charts and counts on the homepage are **concept art**, clearly labeled
  and never passed off as real performance data.

## Athlete / Coach discovery (Issue #388)

The homepage product-discovery section has exactly two **descriptive** OVRANTO
surfaces: Athlete and Coach. These are marketing cards, not real app screenshots,
analytics, testimonials or launch announcements. Both are visibly labeled
"In development" (localized UK/EN) with a public-access disclaimer. The links
lead only to existing local `/for-athletes` and `/for-trainers` overview pages;
links to `app.ovranto.com` and `coach.ovranto.com` remain gated by the verified
host, TLS and product deployment requirements in #393.

The product-specific layout lives in `apps/landing/src/widgets/home/ui/`
rather than generic `@gym/ui-web`. The final `/apps` catalogue CTA remains
available below the workflow section. No new imagery or unsupported feature
claims were introduced; add genuine approved screenshots in a separate slice.

## Public theme preference

The marketing header offers one accessible System / Light / Dark selector across
desktop and mobile. It defaults to System and responds automatically to OS theme
changes through the canonical OVRANTO CSS media query (no JavaScript listener).
Manual overrides set or remove the root .light / .dark class immediately.

Landing reads the host-only, SameSite=Lax ovranto-theme cookie in its **server
root layout** and emits the initial HTML class. Manual themes therefore render
before hydration, without a theme flash or mismatch. The 12-month preference
uses the same cookie contract as Web but is scoped to its own host; Landing
never writes Domain= or accesses Athlete/Admin session cookies. Local HTTP
omits Secure; deployed HTTPS adds it. Unknown values return to System.

Verify system OS changes, initial server response class, cookie persistence
across navigation/reload, UA/EN accessible names, and 320/390px mobile navigation. Below 440px the
shared vector mark remains visible with an accessible OVRANTO home-link name
while the decorative wordmark text is visually hidden to prevent overflow.

## Accessibility and constraints

Keep a single h1 on each route and a named main landmark. Logo SVG must be decorative
inside a properly named home link. Preserve real links, locale strings, dynamic navigation,
analytics events, SEO metadata, SSR and 320px layout with no horizontal overflow.
Use visible focus-visible styles and 44px touch targets for CTAs/menu. Respect
prefers-reduced-motion, and don't introduce autoplay or fake availability claims.
Keep existing product names/routes/metadata until a separate approved product naming
or SEO migration. The OVRANTO visual wordmark is the brand identity, but those are
not silently renamed by this visual-only PR.

## QA

- pnpm --filter @gym/landing test
- pnpm --filter @gym/landing typecheck
- pnpm --filter @gym/landing lint
- pnpm --filter @gym/landing build
- pnpm --filter @gym/landing test:e2e

On Linux development machines with system Chrome but no downloaded Playwright
Chromium, set LANDING_E2E_CHROME_PATH=/usr/bin/google-chrome before the E2E
command. CI still uses the default pinned Playwright browser.

Check light and dark OS themes, mobile and desktop, all public routes, UA/EN
component labels, accessibility semantics, navigation links and planned-features
disclaimers. Next.js needs access to Google Fonts **at build time** to self-host
Manrope; release runners should confirm the generated font assets are present.
