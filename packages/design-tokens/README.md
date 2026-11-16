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
