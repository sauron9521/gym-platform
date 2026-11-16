# @gym/ui-web

Shared browser-side React components for Web and Landing.

This first migration consolidates the identical `Button` implementation.
Both apps keep their existing `@/shared/ui/button` compatibility re-export
and local semantic CSS themes. The shared package must not import app code.

Both Next.js apps list `@gym/ui-web` in `transpilePackages` and declare
a Tailwind CSS 4 `@source` entry so variant utility classes from the
workspace are retained. Native Expo UI remains separate.
