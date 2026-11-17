# SEO and social previews

- Set `LANDING_SITE_URL` to the verified **HTTPS origin**, no path or trailing query.
- Indexing is disabled by default even when a domain is configured.
- After every public route has finished content and canonical URLs have been verified, explicitly set `LANDING_ALLOW_INDEXING=true`.
- Inspect `robots.txt`, `sitemap.xml`, `/opengraph-image` and generated metadata on the deployed build.
- Brand preview is generated with `next/og`; no remote images or fonts are required.
- Turborepo already hashes `LANDING_SITE_URL` and `LANDING_ALLOW_INDEXING` for builds (merged PR #190); verify the production build after changing either value.
