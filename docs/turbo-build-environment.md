# Build-time environment inputs

Turborepo hashes `LANDING_SITE_URL`, `LANDING_ALLOW_INDEXING`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_SCRIPT_URL` for the `build` task. The Landing app uses these public inputs for canonical metadata, search indexing (PR #209) and optional analytics (PR #212). Reusing an old `.next` output could publish stale URLs, indexing rules or analytics settings.

`GYM_API_INTERNAL_URL` is already declared as a global environment dependency for the authenticated Next.js build. Expo's `EXPO_PUBLIC_*` variables are framework-inferred by Turborepo; do not put server secrets under `EXPO_PUBLIC_*`.

The root build task currently hashes these Landing-specific values for all workspaces, which can invalidate unrelated builds. App-specific task configuration can be evaluated separately if these unnecessary rebuilds become measurable.

Production values are not required in PR CI. After changing build inputs, run `pnpm test:tooling`, `pnpm format:check` and the affected app's production build. Cache correctness does not replace release-time validation of the real domain, indexability or analytics provider.
