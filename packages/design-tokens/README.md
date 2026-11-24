# @gym/design-tokens

The shared OVRANTO v2 **Premium Athletic Minimal** semantic palette is used by Athlete Web, Trainer Web, Admin, Landing and Mobile. Deep Teal and Terracotta brand marks retain fixed colors; semantic foregrounds, surfaces and primary colors vary for contrast in Light and Dark modes.

## Current consumers

| Consumer                                 | Token entrypoint                    | Theme behavior                                                                  |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Athlete Web, Trainer Web, Admin, Landing | `@gym/design-tokens/ovranto.css`    | System, Light, Dark; server-rendered root class from the local theme cookie     |
| Mobile                                   | `@gym/design-tokens/ovranto-native` | Current StyleSheet adapter uses the dark palette; UniWind defines both palettes |

All four Next.js apps import the shared stylesheet in their own `src/app/globals.css`. The legacy `dark.css` and `native` exports remain available and tested for compatibility; they are not the current app theme. Do not import both root stylesheets together.

## CSS usage (Tailwind CSS 4)

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@gym/design-tokens/ovranto.css';
```

Keep the app-specific `@theme inline` utility mappings and layout styles local; use semantic tokens rather than copying brand or surface values. System uses the OS preference, with Light as the CSS fallback. Explicit `.light`, `.dark` or `data-theme` overrides take precedence. The apps persist valid preferences in their own host-only `ovranto-theme` cookies and apply the initial root class on the server. Token CSS does not itself manage cookie persistence.

## Native adapter

`ovrantoNativePalette.light` and `.dark` expose typed semantic values. Mobile's `src/shared/config/theme.ts` maps its existing StyleSheet palette to `.dark`; full native Light/System switching is a separate runtime/UI migration. Mobile `global.css` mirrors both OVRANTO palettes as UniWind RGB channels. Keep that mapping synchronized when changing the shared descriptor. Do not assume CSS support proves full native theme switching.

## Source and verification

Edit `src/palette-source.json`, not generated CSS or TypeScript. The generator produces both current OVRANTO and legacy outputs. Run from the repository root:

```sh
pnpm --filter @gym/design-tokens tokens:generate
pnpm --filter @gym/design-tokens test
```

Vitest checks generated-file drift, CSS/native parity, semantic colors and contrast, including the confirmed, active, pending and error workout-set states. The package build runs its test command. The legacy OKLCH-to-sRGB parity checks still protect the legacy outputs. Review affected app rendering, native channel mappings, focus states and accessibility after token changes; passing token tests alone does not establish visual or release acceptance.

See the [Landing visual identity and motion guide](../../docs/landing/visual-identity.md) for public-site usage and screenshot provenance.
