# Build-time environment inputs

Turborepo must invalidate the `build` cache whenever a public Landing build-time setting
changes. Reusing a previous `.next` output could otherwise publish stale SEO metadata,
indexing rules, or analytics configuration to a different deployment.

The root `turbo.json` currently hashes these values for the `build` task:

| Variable | Reason |
| --- | --- |
| `LANDING_SITE_URL` | HTTPS canonical origin, robots and sitemap |
| `LANDING_ALLOW_INDEXING` | Explicit opt-in to indexing (Landing PR #209) |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Public analytics site identifier (Landing PR #212) |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | Public analytics script URL (Landing PR #212) |

The latter three values are included *before* their feature PRs merge, so those changes
cannot silently re-use an earlier build. Unconfigured values are valid in PR CI;
do not set a real production domain or analytics identifier just to pass tests.

`GYM_API_INTERNAL_URL` is already a `globalEnv` dependency for authenticated Next.js
builds. Expo `EXPO_PUBLIC_*` variables are framework-inferred by Turborepo. Never put
credentials or server secrets in `NEXT_PUBLIC_*` variables.

**Scope:** `tasks.build.env` applies to all workspaces using the root build task,
so changing a Landing setting can invalidate unrelated builds. This is a safe,
conservative starting point; isolate it in an app-specific Turborepo config if
unnecessary rebuilds become measurable.

When changing these contracts, update `turbo.json` and this document, run
`pnpm test:tooling` and the affected app's production build, and verify
`pnpm format:check`. The contracts cover cache inputs; they do **not** replace
release-time validation of the real domain, indexability or analytics provider.
