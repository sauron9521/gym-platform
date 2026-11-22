# Admin API cookie-only authentication boundary (#289)

**Status: partial security hardening, not a complete admin-session implementation.**

The existing privileged routes now require an authenticated, persisted,
server-side cookie session via `@Authenticate({ providers: [SessionAuth] })`:

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
Admin Web login continues using ordinary server-issued session cookies.

**Still NO-GO:** A normal login cookie currently provides the initial admin
identity; it is not a separate, shorter-lived admin-purpose session. Complete
#289 with distinct admin purpose/context, bounded idle/absolute expiry,
separate revocation, origin and session lifecycle tests. Complete #290 for
recent proof of password/MFA, step-up expiry and safe recovery before enabling
account suspension/reactivation or role/price privilege changes. The current
trainer-review write endpoints already exist but remain without step-up, which
must be addressed as part of the future sensitive-mutation hardening.

No new privileged HTTP endpoints, cookies, sessions or Prisma migrations are
introduced in this slice.
