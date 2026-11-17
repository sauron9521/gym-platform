# Build-time environment inputs

Turborepo hashes `LANDING_SITE_URL` for the `build` task. The landing app uses that origin to generate canonical metadata, robots and sitemap. Reusing a prior `.next` output after changing the origin could produce incorrect SEO links.

`GYM_API_INTERNAL_URL` is already declared as a global environment dependency for the authenticated Next.js build. Expo's `EXPO_PUBLIC_*` variables are framework-inferred by Turborepo; do not put server secrets under `EXPO_PUBLIC_*`.

When changing these contracts, edit `turbo.json`, update this document and run `pnpm test:tooling` plus `pnpm build` in the affected environment. This does **not** require a live production hostname in PR CI.
