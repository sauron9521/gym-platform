# Admin cookie/browser proxy smoke — Issue #289

This fixture-backed Chromium suite verifies actual Next.js /backend rewrites and
host-only browser cookie behavior. It is **not** a real NestJS/PostgreSQL or
staging smoke test. The API/PostgreSQL E2E suite independently verifies real
session storage, 8h/15m expiry, origin enforcement and scoped revocation.

## Automated browser checks

Run from the repository root:

    pnpm --filter @gym/admin test:e2e

The suite launches a deterministic loopback API at 127.0.0.1:3311 and the
**real** Next.js Admin app at localhost:3310. It verifies:

- The __Host-admin-sid cookie passes through Next rewrite and Chromium stores
  it as Secure, HttpOnly, SameSite=Lax, Path=/ and host-only;
- The cookie is not sent to the differently named upstream host;
- __Host-sid cannot authenticate Admin, and both cookie realms can coexist;
- Browser-triggered admin-sign-out and scoped revoke-all clear **only**
  the Admin cookie while ordinary login remains valid;
- Pending MFA clears Admin cookie and cannot open the dashboard.

Set ADMIN_E2E_CHROME_PATH=/path/to/chrome to run against an existing local
Chrome binary. CI uses the version-pinned official Playwright Chromium image
and requires the Admin browser job on Admin changes.

## Staging/manual acceptance (NOT YET VERIFIED)

Before closing #289, deploy the approved build and record evidence of:

- **HTTPS and reverse proxy:** correct Secure, HttpOnly, SameSite=Lax,
  host-only __Host-admin-sid, no Domain, Path=/ and Set-Cookie propagation;
- **Separate realms:** Admin and ordinary sessions coexist in one browser;
  only Admin cookie reaches privileged routes, regular cookie works after
  Admin logout, and __Host-admin-sid does not authorize ordinary API routes;
- **Expiry:** 15-minute idle and 8-hour absolute expiry in the real
  database; no browser resurrection after expiry or revocation;
- **Revocation:** two real browsers/devices revoked with one Admin-only
  revoke-all; other users and ordinary sessions survive;
- **Origin/CSRF:** untrusted Origin/Referer and cross-site browser requests
  denied; trusted configured ADMIN_APP_URL works through the proxy;
- **MFA and account state:** pending MFA denied, suspended/removed admins
  fail closed and logout clears only privileged cookie.

Capture anonymized HTTP statuses, browser cookie attributes (never tokens),
deployment version and CI links. Do **not** claim staging is complete or
close #289 solely because this fixture browser suite passed.

## Disposable real API and PostgreSQL browser smoke

The second suite uses real NestJS and Prisma/PostgreSQL alongside the real
Next Admin UI and Chromium, not a fixture API. It runs as part of the existing
required Admin Chromium CI job after Prisma migrations, safe operator seeding
and an API build. Its one two-browser flow deliberately stays within the
production authorization rate limit of three login attempts per minute from
one IP address.

The seeding script at apps/api/test/support/seed-admin-browser.ts refuses all
non-test environments, mismatched DB URLs, non-local/non-CI Postgres hosts,
and databases other than gym_admin_browser_test. It never contacts a deployed
database and uses the actual PasswordHasher (scrypt) from the auth library.

For local verification, provision your OWN disposable PostgreSQL instance
called gym_admin_browser_test, export matching DATABASE_URL and
TEST_DATABASE_URL for that database and set NODE_ENV=test. Then:

    pnpm --filter @gym/api db:generate
    pnpm --filter @gym/api db:migrate:deploy
    pnpm --filter @gym/api exec tsx test/support/seed-admin-browser.ts
    pnpm --filter @gym/api build
    ADMIN_E2E_CHROME_PATH=/usr/bin/google-chrome pnpm --filter @gym/admin test:e2e:real-api

The Playwright config starts real API port 3321 and Next Admin port 3320.
Tests cover the protected Admin directory, cookie flags/host isolation,
the ordinary login session surviving an Admin logout, foreign
Origin/Referer denial and revocation across two real browser contexts.

Passing does NOT prove externally hosted staging, TLS termination or actual
idle/absolute TTL under wall-clock expiry. The manual staging checklist above
remains outstanding before issue #289 can close.
