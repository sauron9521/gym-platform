# @gym/ui-web

Shared browser-side React components for Web and Landing.

This first migration consolidates the identical `Button` implementation.
Both apps keep their existing `@/shared/ui/button` compatibility re-export
and local semantic CSS themes. The shared package must not import app code.

Both Next.js apps list `@gym/ui-web` in `transpilePackages` and declare
a Tailwind CSS 4 `@source` entry so variant utility classes from the
workspace are retained. Native Expo UI remains separate.

## Shared primitives

The package exports `Button`, `Input`, `Card` and its semantic slots.
Use semantic design tokens from each consuming Next.js app instead of embedding palette values here.
Keep business-specific forms, routing and API hooks inside their app; this package is UI-only.

## OVRANTO brand component (BrandLogo)

`BrandLogo` renders the approved two filled diagonal strokes as a decorative
inline SVG followed by the **real HTML** `OVRANTO` wordmark and optional
`PERFORMANCE PLATFORM` tagline. It is **not** an `h1` and has no router
or SEO metadata dependency. The consuming application wraps it with its own
accessible home link; keep the page's `h1` descriptive of the page content.

```tsx
import Link from 'next/link';
import { BrandLogo } from '@gym/ui-web';

<Link href="/" aria-label="OVRANTO — головна">
  <BrandLogo />
</Link>;
```

`showTagline={false}` hides the tagline when navigation space is limited.
The wordmark and tagline inherit semantic `text-foreground` and
`text-muted-foreground` colors for Light/Dark. The two SVG brand colors
are intentionally fixed; a DOM test checks its path geometry against
`assets/brand/mark.svg` to prevent divergence. Manrope is the approved
font; load it once in each app in a future typography PR, not as a binary
asset here. Mobile Expo uses native UI and must not import `@gym/ui-web`.

This PR adopts the brand only in the Athlete Web protected header. Landing
header/footer changes are deferred because open localization PR #258 touches
both files; PR #270 separately modifies the UI package export barrel.
