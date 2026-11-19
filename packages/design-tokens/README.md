# @gym/design-tokens

Shared semantic design tokens for Gym Platform. This first extraction preserves
the existing Landing **Dark Performance** theme byte-for-byte. Web/Native are
not migrated in this PR; doing so will be a separate reviewed visual change.

## Usage (Landing / Tailwind CSS 4)

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@gym/design-tokens/dark.css';
```

Keep the consuming app's `@theme inline` mapping and component styles local
until both Web and Landing are migrated to `@gym/ui-web`.

The package build runs Node regression checks for mandatory semantic tokens.
The existing Next.js build verifies bundler resolution of the workspace CSS.

## Native adapter

Expo imports the `@gym/design-tokens/native` adapter for React Native
StyleSheet colors. These sRGB values are explicit approximations of the
canonical OKLCH Dark Performance palette. Mobile UniWind's `.dark` variables
use the same RGB channels; keep the two in sync when editing the design.

## Native/CSS color parity

`pnpm --filter @gym/design-tokens test` checks that each shared React Native HEX token is the sRGB conversion of its canonical CSS OKLCH color. Update `src/dark.css` and `src/native.ts` together when changing the palette. The test prevents visually inconsistent themes from reaching Web, Landing, Admin and Mobile.

## OVRANTO v2 palette (additive, not yet adopted in apps)

A new `ovranto` section in `src/palette-source.json` provides the
approved Premium Athletic Minimal colors: Deep Teal, Terracotta, warm Ivory,
Charcoal and readable Light/Dark semantic values. The same generator writes
`ovranto.css` and `ovranto-native.ts` in addition to legacy outputs.

- Web CSS: OS theme by default; explicit `.light`, `.dark` and
  `data-theme="light|dark"` overrides.
- Expo: typed `ovrantoNativePalette.light` and `.dark` entries.
- Both modes: confirmed, active, pending and error background/foreground
  values for the owner-approved compact, fully color-coded workout set rows.
- Brand mark fills stay fixed; semantic primary may be contrast-adjusted
  for legibility in Dark mode.

Consumers still use existing Dark Performance tokens until separate app
migration PRs. The new CSS and native exports are opt-in: existing app
behavior, routes and persisted theme preferences remain unchanged. **Do not import both root stylesheets together.** Theme
persistence/hydration and app integration will follow separately.

Run `pnpm --filter @gym/design-tokens tokens:generate` and
`pnpm --filter @gym/design-tokens test` after editing the descriptor.
