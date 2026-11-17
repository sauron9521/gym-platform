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
