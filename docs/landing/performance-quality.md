# Landing quality and performance targets

The Landing is primarily statically rendered and should stay free of unnecessary client bundles.

## Release targets (measured on deployed production builds)
- Lighthouse Performance, Accessibility, Best Practices and SEO >= 90 on key pages.
- LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms at the 75th percentile under applicable field data.
- No horizontal overflow at 320 / 390 / 768 / 1280 px.
- The primary heading remains visible with reduced motion enabled.
- Every advertised destination has a usable, non-empty page; 404 has a recovery link.
- Prefer CSS effects, server rendering and optimized local screenshots over large animation packages.

## How to validate
1. Run `pnpm --filter @gym/landing test:e2e` for responsive browser smoke checks.
2. Run a production `next build` and serve the output, then measure Lighthouse mobile and desktop.
3. Do not interpret passing E2E as proof of Lighthouse scores or Core Web Vitals.
4. Only after real traffic exists, compare field data to target percentiles.
