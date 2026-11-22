# External Admin HTTPS and session smoke — #289

This is a **manually dispatched external-staging-only** Playwright browser workflow.
It does not run on pushes, pull requests, schedules, or deployments and does not
authorize production use. No hosted staging credentials are shipped in code.
The workflow does not provision staging, create accounts or run migrations.
**First run the anonymous preflight-only scope; it requires NO operator credentials.**
Only credentialed scopes (quick, idle-expiry, revoke-all) can read the
Environment email/password secrets, in the browser test step alone.

## One-time GitHub setup before first run

Create GitHub Environment **admin-staging** in repository Settings / Environments.
Configure required reviewers, allowed deployment branches (main only) and
environment-specific variables/secrets, NOT repository-level production secrets.
Only a staging-only identity should be used. The workflow runs on main only.

Environment **variables**:

| Name                        | Example / rule                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| ADMIN_STAGING_ORIGIN        | https://admin.staging.example.com (canonical HTTPS origin, exact staging DNS label, no port/path) |
| ADMIN_STAGING_ALLOWED_HOST  | admin.staging.example.com (must exactly match origin hostname)                                    |
| ADMIN_PRODUCTION_ORIGIN     | https://admin.example.com (distinct canonical production origin, never staging)                   |
| ADMIN_STAGING_ACCOUNT_SCOPE | DEDICATED_STAGING_ONLY (required confirmation)                                                    |

Environment **secrets** (only needed for credentialed scopes, not preflight-only):

| Name                   | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| ADMIN_STAGING_EMAIL    | Email of an isolated Admin test operator existing ONLY in staging |
| ADMIN_STAGING_PASSWORD | Password of that isolated Admin test operator                     |

Staging Admin must serve real HTTPS with valid certificates, map /backend
through its configured reverse proxy to the **staging** NestJS API, and set
ADMIN_APP_URL to that same trusted external origin. Never copy production
accounts, tokens, production secrets or production data into the staging
account or environment. An MFA-required account currently fails closed; this
workflow cannot bypass MFA. Full MFA challenge/step-up remains in #290.

The target validator rejects non-HTTPS origins, ports, redirect URL paths,
missing or mismatched allowlist, localhost, private/test names, hosts without
a **staging** DNS label, exact production hostname/origin, missing
staging-only account declaration, and unrecognized test modes. The browser
also rejects any cross-origin sign-in redirect **before filling credentials**.

## Execution

After this PR is merged, open Actions -> **Admin staging HTTPS and session
smoke (manual)** -> Run workflow. Select the main branch, then set:

- confirm_staging = RUN_DEDICATED_STAGING (default NO_STAGING_RUN).
- scope = preflight-only (default): read-only GET checks for sign-in HTML,
  backend liveness, backend readiness and unauthenticated Admin session (401).
  All requests disable cookies, caching and redirects, and enforce HTTPS
  host allowlisting. This scope **never loads staging credentials or installs
  application dependencies**.
- scope = quick: sign in, inspect browser cookie attributes and
  Set-Cookie through the actual HTTPS proxy, check active session, reject
  foreign Origin/Referer, sign out, and prove cookie/session removal.
- scope = idle-expiry: sign in, then perform NO session requests for 16
  minutes; verify that the API rejects the expired Admin session. This uses
  an intentionally longer, manual-only Actions run.
- scope = revoke-all: create two independent browser Admin sessions, revoke
  every Admin session for the **dedicated staging operator** and verify
  neither survives. This will also log out any other Admin sessions that
  operator has. You MUST additionally set confirm_revoke to
  I_APPROVE_STAGING_REVOKE (otherwise the job will not execute).

Every credentialed scope first passes the same anonymous HTTPS/Next/proxy
preflight, then installs test dependencies, and only then injects the
Environment email/password into the browser test step. Earlier checkout,
setup, preflight and install steps never receive these secrets.

The tests never print raw session cookies or passwords and disable traces,
screenshots and videos. The workflow does not upload browser artifacts.
Record the workflow URL, source SHA, chosen scope, pass/fail outcome and
manually inspected deployment version in the #289 verification evidence.
Do not paste credentials, tokens or browser storage into issues or logs.

## Verification gaps

- A passing preflight-only scope demonstrates public HTTPS reachability,
  Next sign-in HTML, unauthenticated reverse-proxied health endpoints and
  fail-closed Admin session. It cannot prove credentials, Admin cookies,
  session expiry or real staging authorization.
- A passing quick scope validates deployed HTTPS, same-origin Next proxy,
  cookie attributes and login/logout only for that specific staging
  deployment, not for production routing.
- Idle scope checks only the actual **15-minute idle** cutoff. Real
  **8-hour absolute** cutoff requires a separate controlled verification
  mechanism; Github hosted runners cannot run for eight hours.
- Revoke-all is explicitly destructive on the staging-only Admin operator.
- Cross-host ordinary-user session coexistence, suspended admin behavior,
  real MFA/step-up, rollback and real production readiness remain separate
  acceptance criteria. Do not mark #289 complete merely because the
  workflow was added; require actual successful staging-run evidence.

## Local dry-run (no browser navigation)

With safe dummy values, running the following command only discovers tests:

    ADMIN_STAGING_ORIGIN=https://admin.staging.example.com
    ADMIN_STAGING_ALLOWED_HOST=admin.staging.example.com
    ADMIN_PRODUCTION_ORIGIN=https://admin.example.com
    ADMIN_STAGING_ACCOUNT_SCOPE=DEDICATED_STAGING_ONLY
    ADMIN_STAGING_SCOPE=quick
    ADMIN_STAGING_EMAIL=not-real@example.test
    ADMIN_STAGING_PASSWORD=not-a-real-password
    pnpm --filter @gym/admin exec playwright test --config playwright.staging.config.mjs --list

Supply these as environment variables in a single shell invocation or export
them individually before the last command. Never execute the actual staging
browser tests against dummy/non-staging URLs or use production secrets.
