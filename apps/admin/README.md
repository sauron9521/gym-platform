# Gym Platform Admin — cookie-session sign-in foundation

The Next.js Admin app uses port 3003 locally. Browser requests to
`/backend/*` are rewritten by Next.js to the server-configured NestJS API.
The browser session cookie therefore remains host-only on the Admin origin
rather than sharing credentials with the Web site.

## Local configuration

1. Set `GYM_API_INTERNAL_URL=http://localhost:3001` in `apps/admin/.env.local`.
   This is a server-only value; never use `NEXT_PUBLIC_*` for it.
2. Set `ADMIN_APP_URL=http://localhost:3003` in the **API** environment,
   then restart the Admin and API processes. Production requires HTTPS.
3. Open `http://localhost:3003/sign-in` and sign in with an existing
   administrator account. The client verifies `GET /users/me`, and the
   Admin home page checks role and session **again on the server**.

## OVRANTO read-only workspace shell (#387)

The authenticated home uses the approved OVRANTO Light/Dark semantic tokens and
Manrope with a compact desktop sidebar, accessible mobile navigation and a
manual System/Light/Dark preference stored in the existing `ovranto-theme` cookie.
Ukrainian and English copy is sourced from `@gym/i18n`.

**Overview** and **Users** link to real routes; the latter is a server-rendered,
read-only account directory restricted to explicitly allowlisted Super Admin
operators. Ordinary ADMIN sessions see no records. Roles, Exercise catalog,
Moderation, Audit and Settings stay non-interactive placeholders until server-side
permissions and corresponding APIs are implemented. Overview shows live API readiness, while the Users route renders only
PII-minimized account rows for explicitly authorized operators. No synthetic
KPIs, privileged mutations or unrelated account fields are rendered. Unauthorized
requests never fetch readiness or privileged data. A successful build does not
make this Admin console ready for production.

## Admin Users directory UI (#387, follow-up to #592)

The `/users` route verifies the Admin session on the Next.js server **before**
requesting `GET /admin/users` from a fixed, server-only NestJS origin. The API
independently requires `admin.accounts.read` (persisted ADMIN role **and** explicit
`SUPERADMIN_USER_IDS` allowlist); ordinary ADMIN sessions receive 403. No session
cookie, raw API response or upstream address is sent to browser JavaScript.

Email search (2–100 chars), role filter and 20-row pagination are implemented as
standard GET forms/links and **server-side API queries**, not filtering a single
page client-side. The API's fixed newest-first order is shown explicitly; no
unsupported email sorting or `SUSPENDED` filter is offered, because the API
has no suspension lifecycle. Counts come from backend `meta.total`, not fixtures.
`force-dynamic`, uncached upstream fetch and no-store response headers protect
against shared HTML caching. The response is checked against an exact PII-minimal
schema before rendering. 401/403/invalid/unavailable all fail closed with
**zero** account rows and disabled controls. The directory links to a separate read-only `/users/[id]` account detail
route. That page uses a second server-only, explicitly allowlisted API read
with a validated UUID, seven-field response whitelist, no-store headers,
localization, and 401/403/404 error states. No account mutation,
role assignment or durable audit history is enabled. Production operational rollout
still needs independent staging/security checks.

## Mandatory manual staging checks before deploying an operational console

- Verify host-only, Secure, HttpOnly and SameSite cookie behavior through
  the actual admin hostname and HTTPS reverse proxy.
- Ensure a Web host session does not automatically authorize the Admin host.
- Exercise correct/incorrect credentials, ATHLETE/TRAINER denial, pending MFA,
  expired sessions, logout, and blocked CSRF from untrusted Origins.
- Verify session and credential values are never logged or exposed to HTML.
- Validate cookie scope, secure backend routing and browser E2E with a
  disposable staging account. Do not deploy privileged workflows before then.

**Read-only operator UI only:** the existing Super Admin read permission does not
authorize account mutations, role assignment, moderation CRUD, durable audit
history or a production Admin release.
