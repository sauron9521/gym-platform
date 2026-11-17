# Gym Platform Landing — Dark Performance

## Brand
- The mark is a minimalist dumbbell in a rounded square, authored as SVG.
- Use the shared semantic colors from `@gym/design-tokens`, not scattered hex values.
- The site icon lives in `apps/landing/src/app/icon.svg`; the UI mark is `shared/ui/brand-mark.tsx`.
- Keep the wordmark as selectable text. Do not use generated or hosted font files.
- Maintain accessible contrast, visible focus indicators and sufficient clear space.

## Type scale
- Hero: `text-5xl sm:text-7xl`; heading: `text-3xl sm:text-4xl`; body: `text-base`/`text-lg`.
- Prefer system fallbacks to avoid Google Fonts build dependencies.
- Respect reduced-motion preferences. Marketing animations must never block navigation.
