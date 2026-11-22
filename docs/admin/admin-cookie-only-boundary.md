# Admin API cookie-only authentication boundary (#289)

**Status: dedicated admin-purpose login/scope implemented; bounded lifetime and separate revocation remain open.**

The existing privileged routes now require an authenticated, persisted,
server-side cookie session via `@Authenticate({ providers: [SessionCookieProvider] })`:

- `GET /admin/users` and `GET /admin/users/:userId`
- `GET /admin/trainer-applications`
- `POST /admin/trainer-applications/:id/approve`, `reject`, `revoke`

A valid JWT bearer token (even one issued to an allowlisted operator) **never
substitutes** for the cookie. When a cookie and conflicting bearer token are
both supplied, authorization uses the cookie principal alone. Existing
permission policies re-read the persisted operator role and allowlist.
Expired, suspended or revoked cookies are rejected by the existing SessionStore.
Authentication failures must not return personal records, and responses remain
`Cache-Control: no-store`.

**Compatibility:** `/auth/token` and normal Athlete/Trainer/API bearer routes
are unchanged. The privileged endpoints intentionally cease to support
bearer-only clients. Swagger declares cookie authentication for them. The
Admin Web login now requires a fresh admin-purpose cookie instead of reusing
ordinary application login state. Existing Admin browsers must sign in again
after deployment. The cookie is still server-issued and HttpOnly.

**Admin-purpose login:** A normal `/auth/login` cookie no longer authorizes Admin
routes. `POST /auth/admin-login` requires fresh password verification and
a currently persisted ADMIN role, and issues a session containing a server-only
`metadata.purpose = "admin"` marker. `GET /auth/admin-session` verifies it
using cookie-only authentication and replies with only `id` and `role`. The
Admin Web checks this endpoint for every protected page request.

**Still NO-GO:** The admin-purpose session still uses the shared cookie name,
session table and default expiry/revocation infrastructure; do not claim
complete isolation. Finish #289 with admin-specific idle/absolute expiry,
separate revocation, origin and lifecycle checks. Complete #290 for
recent proof of password/MFA, step-up expiry and safe recovery before enabling
account suspension/reactivation or role/price privilege changes. The current
trainer-review write endpoints already exist but remain without step-up, which
must be addressed as part of the future sensitive-mutation hardening.

No Prisma migration or separate cookie realm is introduced in this slice.
