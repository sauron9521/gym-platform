# @gym/ui-web

Shared browser-side React components for Web and Landing.

This first migration consolidates the identical `Button` implementation.
Both apps keep their existing `@/shared/ui/button` compatibility re-export
and local semantic CSS themes. The shared package must not import app code.

Both Next.js apps list `@gym/ui-web` in `transpilePackages` and declare
a Tailwind CSS 4 `@source` entry so variant utility classes from the
workspace are retained. Native Expo UI remains separate.

## Shared primitives

Use `cn` from `@gym/ui-web/utils` for class composition and Tailwind conflict
resolution. This subpath has no client directive and is safe for server-side
class composition. The Web app retains its local `@/shared/lib/utils` alias
for shadcn generation as a re-export, not a second implementation.

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

## OVRANTO control and surface foundation (#383 / #391)

`Button`, `Input` and `Card` retain their public names, props and existing
variants, with token-based 12–16px radii, visible keyboard focus, reduced-motion
support and restrained card elevation. The existing `@gym/ui-web` is the single
shared React Web UI package: no new component library or palette constants.

- Use `<Button size="touch">...</Button>` or `size="iconTouch"` on web
  interactions that require a 44px touch target. Existing `default`, `sm`, `lg`
  and `icon` sizes are unchanged. Supply an accessible name to icon-only buttons.
- Set `disabled` during a write in flight and provide truthful pending/success/error
  feedback at the feature level. Styling does not implement request deduplication.
  Open PR #270 owns the separate `AsyncFeedback` component; this change does not
  touch its export or APIs.
- Pass `aria-invalid={true}` to an `Input` when validation fails, and connect
  it to an error description with `aria-describedby`. Error styles are not a
  replacement for a visible error message. `disabled` remains native.
- `Card` is a semantic surface, not a landmark by itself; supply headings and
  labels as appropriate. Avoid unnecessary shadow nesting in dense Trainer/Admin UI.
- Each consumer retains its own semantic Light/Dark CSS. Destructive buttons read
  `--destructive-foreground` if present (OVRANTO), and fall back to white for
  the legacy palette during staged migration.

All controls remain shared by the Next.js apps and may inherit current app theme
variables. No native Expo use of `@gym/ui-web`, no migration of marketing visuals,
and no new runtime dependencies. Verify Light/Dark, uk/en long text, zoom,
keyboard focus, screen readers and actual mobile touch targets during app rollout.
