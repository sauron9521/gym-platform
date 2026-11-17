# Gym Platform Landing — production readiness

This PR adds security headers, automated configuration checks and a manual
release checklist. **It does not deploy the Landing or certify production
readiness.** There is no verified domain or measured production performance
evidence in this PR.

## Release sequence

1. Confirm content, SEO, accessibility, responsive QA, analytics and build-cache PRs have merged. Build-cache inputs from #190, SEO #209 and analytics #212 are already on main.
2. Obtain and **independently verify ownership, DNS resolution and TLS** for the real production origin. A syntactically valid URL alone is not proof.
3. Set `LANDING_SITE_URL` to that public HTTPS origin. Keep `LANDING_ALLOW_INDEXING` **unset or false** until the content/SEO launch decision has been approved.
4. Confirm route content, honest product availability statements, CTAs, legal/privacy disclosures and metadata.
5. Decide separately whether search indexing is approved. Only then set `LANDING_ALLOW_INDEXING=true`. A valid noindex launch must not be blocked.
6. Keep Umami public settings unset by default. Before opting in, check provider trust, page-view tracking, retention, privacy notices, consent requirements and content security policy.
7. Run `node apps/landing/scripts/release-preflight.mjs` with actual release environment values. It checks **configuration shape only**, not domain ownership, privacy compliance or deployment health.
8. Run `pnpm --filter @gym/landing lint`, `typecheck`, `test`, `build` and `test:e2e`; test the actual production build, not only a development server.
9. Verify deployed canonical tags, robots/sitemap versus approved indexing, Open Graph previews, `404`, internal navigation and HTTP headers at the edge/CDN.
10. Measure Lighthouse mobile/desktop and Core Web Vitals. Performance targets are not automatically enforced by this PR.
11. Record release artifact SHA, deploy ID, operator approval and rollback method before switching traffic.

## HTTP security controls

- `X-Content-Type-Options: nosniff` prevents content sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` reduces cross-origin referrer detail.
- `Permissions-Policy` denies camera, microphone and geolocation.
- Next.js `X-Powered-By` is disabled.
- The new browser test checks these HTTP responses under the Next.js test server.

**Not implemented:** Content Security Policy (CSP), HSTS, edge/CDN enforcement,
consent UX or automated deployment. CSP requires verifying Next.js hydration
and optional analytics. HSTS requires a deliberately configured HTTPS domain
and hosting strategy. Do not claim these controls are in place.

## Rollback and incident response

Keep a previous verified deploy and immutable build artifact available.
If navigation, security headers or metadata regress, stop promotion and route
traffic back to the previous artifact. For an indexing mistake, correct the
deployed robots/meta configuration and rebuild/redeploy; changing an env variable
without rebuilding may not update static metadata. Inspect the live responses
and cache invalidation after rollback. DNS, traffic shifts and release approval
remain operator-controlled.
