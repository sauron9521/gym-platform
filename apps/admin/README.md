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

**Overview** and **Users** link to real routes; the latter is an unavailable,
read-only UI until the protected list API exists. Roles, Exercise catalog,
Moderation, Audit and Settings stay non-interactive placeholders until server-side
permissions and corresponding APIs are implemented. The only operational status
shown is the live server-gated API readiness response; no synthetic KPIs, user
records, privileged mutations or sensitive account fields are rendered. Unauthorized
requests never fetch readiness or render the workspace. A successful build does not
make this Admin console ready for production.

## Admin Users directory UI (#387, follow-up to #592)

The `/users` route is independently guarded by the server-side Admin session check.
Its responsive directory UI includes accessible table headings, searchable email,
role/status filters, deterministic sorting and pagination, all covered with isolated
component fixtures. The navigation from Overview is active, but the actual table
is **explicitly unavailable** and all controls are disabled in production until
the authenticated, PII-minimized list API from #292 is implemented and reviewed.

No fake account counts or fixture records are rendered in a real session, and the
page does not fetch `GET /users`, since that endpoint does not exist yet. This
PR does not add account mutations, status changes, privileged queries or route
permissions beyond the current ADMIN gate. Route/component tests verify that
non-admin requests never render account data or controls. The UI is not yet a
production operational directory.

## Mandatory manual staging checks before deploying an operational console

- Verify host-only, Secure, HttpOnly and SameSite cookie behavior through
  the actual admin hostname and HTTPS reverse proxy.
- Ensure a Web host session does not automatically authorize the Admin host.
- Exercise correct/incorrect credentials, ATHLETE/TRAINER denial, pending MFA,
  expired sessions, logout, and blocked CSRF from untrusted Origins.
- Verify session and credential values are never logged or exposed to HTML.
- Validate cookie scope, secure backend routing and browser E2E with a
  disposable staging account. Do not deploy privileged workflows before then.

**Foundation only:** no SUPERADMIN permissions, moderation CRUD, durable
audit history or production admin release is enabled in this PR.
