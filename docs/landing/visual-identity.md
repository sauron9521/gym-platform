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

## Product preview asset provenance (#388)

The two marketing images are **actual Chrome renders of the current Next.js UI**,
not generated illustrations, production account data or a claim that a product
is available for public sign-up:

| Static WebP                                     | Source page                 | Data source                                                                                                           |
| ----------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `public/product-previews/athlete-workouts.webp` | `apps/web` `/workouts`      | The loopback-only `apps/web/e2e/support/mock-api.mjs` test account and its two synthetic workouts                     |
| `public/product-previews/coach-workspace.webp`  | `apps/trainer` `/workspace` | A local-only read API fixture with a synthetic Trainer capability, an empty client/program list, and zero test counts |

Both captures were produced from the verified client source at `cb8a1af` on
2026-11-22 in Chrome, 1200×700, Light theme, with the Next.js dev overlay
hidden. Images were converted to optimized, locally hosted WebP without
replacing the underlying real app UI. No user or production records, tokens,
contact details, customer metrics or third-party photography are included.

**The visible workouts and Coach zero counts are test fixtures**, not results
from real people. An adjacent UK/EN caption says so for each preview. The
images have descriptive localized alt text, declared dimensions for stable
layout and lazy loading to protect the hero's LCP. A future refresh must verify
the current UI, image authenticity/privacy, live feature truthfulness, contrast,
mobile layout, and relevant licenses/permissions before replacing these files.
Screenshots are not evidence of Coach deployment or domain readiness (#393).

### Theme-matched image variants

Dark alternatives, also direct Chrome UI captures, were added from `main`
`e687ab3` on 2026-11-22: `athlete-workouts-dark.webp` and
`coach-workspace-dark.webp`. The same loopback-only synthetic records / empty
Coach account, 1200×700 viewport and DevTools-free capture procedure were
used. The HTML root was explicitly checked as `.dark` with
`--background: #111918` on **both real applications** before capture.

Each figure retains the same localized alt text and synthetic-data caption.
Landing CSS shows exactly one of its Light/Dark `next/image` elements using
the canonical root class preference, falling back to the OS scheme only under
System; explicit `.light` overrides a dark OS and vice versa. No JavaScript
theme watcher or separate tracking is used. Validate visible variant, image
load, descriptive alt text, no horizontal overflow and persistence across
manual theme switches, OS changes and navigation in Chromium at 320/1280px.

## Theme-aware screenshot loading / LCP budget (#388)

Product previews keep both real UI screenshots in the DOM so the CSS-only
System / Light / Dark selector continues working before hydration and without
JavaScript. Both variants retain `loading="lazy"`; hidden variants use
`display: none`, preventing an eager duplicate download on initial load.

Next.js 16 recommends `fetchPriority="high"` **without** `preload` /
`loading="eager"` when CSS selects between Light/Dark `next/image` elements:
https://nextjs.org/docs/app/api-reference/components/image#theme-detection

We apply that hint only to both variants of the **first Athlete preview**,
which may be an LCP candidate at desktop sizes, and leave the secondary Coach
preview at the default browser priority. Only the actually visible variant
should be requested initially. Do **not** prefetch or eagerly load both theme
images, and do not treat the Next.js dev LCP warning as evidence of an actual
Core Web Vitals failure.

The regression browser test monitors real `/_next/image` requests on 320px
and 1280px, asserts the hidden theme stays unfetched during initial render,
checks the priority hint and confirms Dark loads on explicit theme change.
This is a request-policy / correctness gate, **not** a measured field LCP
improvement. Before launch, collect p75 real-user LCP via RUM or
production-like Lighthouse traces with repeat runs / realistic mobile
network conditions, and only then decide if artwork placement or priority
needs further work. Keep responsive sizes and dimensions to prevent CLS.

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

## Landing visual polish and motion (Issue #391)

A focused Landing-only visual pass adds a subtle editorial terracotta glow to
the final product CTA, a restrained outline around the hero preview and
transform-only interactions for the existing Athlete/Coach product cards,
workflow steps and CTA actions. The hero copy and existing conceptual UI
preview fade/translate into place once (220–240ms), with a small stagger.
Interaction transitions last 200ms; they only run on hover-capable devices.

All entrance and hover animations are guarded by
`prefers-reduced-motion: no-preference`. **Reduced motion leaves the content
fully visible and disables these animation and transform transitions**.
The improvements require no client-side observer, new library, extra media
downloads, invented product screenshots or external signup URLs. Preserve
both Light and Dark semantic colors, and confirm the same public navigation
and development-status claims in visual reviews.

Run the existing Landing Chromium suite plus
`apps/landing/e2e/marketing-motion.spec.ts` at 320/1280px, with and without
reduced motion, and manually inspect Safari/Firefox, high zoom and both
OS theme modes before public release. Automated motion checks are not a
complete perceptual, vestibular or screen-reader acceptance signoff.

## Homepage section hierarchy and scroll enhancement (Issue #391)

The next Landing visual pass distinguishes the Athlete/Coach discovery and
three-step workflow sections with restrained semantic backgrounds, terracotta
to teal editorial rules, a slightly tighter section-heading hierarchy, and
larger workflow card headings. It does not alter copy, product availability,
route destinations, image assets or the shared Design System.

Homepage section headings, product discovery, workflow cards and the final
CTA use **CSS view-timeline scroll entrance** when the browser supports it
and `prefers-reduced-motion: no-preference` is active. The short
12px translation and opacity range **0.92–1.0** keep content readable
even before it is fully in view. Unsupported browsers and reduced-motion
visitors receive ordinary static sections; there is no IntersectionObserver,
hydration gate, observer polyfill or new JavaScript package.

The Chromium tests in `apps/landing/e2e/scroll-entrance.spec.ts` cover
mobile Light (320px), desktop Dark (1280px), feature support and reduced
motion. Manually inspect Safari/Firefox, high zoom and keyboard focus
traversal before release. This is visual polish, **not final UX/a11y signoff**.
