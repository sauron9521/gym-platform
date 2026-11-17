# Gym Platform Landing — production readiness

This PR adds security headers and a manual production environment preflight;
it does **not** deploy the Landing or claim the site is production-ready.

## Merge / deployment sequence

1. Merge the content, navigation, quality and SEO PRs after they pass CI.
2. Resolve the existing build-cache environment PR #190 before deployment.
3. Ensure Turborepo build hashes account for `LANDING_SITE_URL`,
   `LANDING_ALLOW_INDEXING` and any analytics public build inputs.
4. Obtain and validate the actual domain. Set `LANDING_SITE_URL` to the HTTPS origin.
5. Review all public copy, product release states, privacy disclosures and routes.
6. Only after approval, set `LANDING_ALLOW_INDEXING=true`.
7. Run `node apps/landing/scripts/release-preflight.mjs`.
8. Run `pnpm --filter @gym/landing lint`, `typecheck`, `test`, `build`, `test:e2e`.
9. Test the deployed build's canonical, robots, sitemap, Open Graph image, mobile navigation,
   HTTP security headers and 404 route.
10. Measure Lighthouse and Web Vitals and verify the final CTA destinations.

## Headers

- `X-Content-Type-Options: nosniff` prevents MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` limits cross-origin referrer detail.
- `Permissions-Policy` disables camera, microphone and geolocation for this presentation site.
- The `X-Powered-By` framework header is disabled.

Content Security Policy (CSP) should be deployed only when an actual hosting strategy,
script loading and analytics configuration have been reviewed; an untested CSP could
break Next.js hydration.

## Rollback

Keep a previous verified deploy available. If metadata, navigation or tracking breaks
after release, return traffic to the previous version and disable indexing if content
integrity is in doubt. Deployments and DNS changes remain operator-controlled.
