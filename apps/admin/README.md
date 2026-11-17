# Gym Platform Admin — authenticated foundation

The admin panel uses the **admin-origin** `/backend` rewrite to NestJS, keeping a host-only session cookie on the admin origin. The sign-in route verifies the session against `GET /users/me` and **denies non-ADMIN users**. Pages perform fresh server-side verification; no client-side role flag grants access.

Set `GYM_API_INTERNAL_URL` in the Admin app; configure `ADMIN_APP_URL` in NestJS to this exact Admin origin so the API CSRF policy explicitly trusts browser writes. Production requires HTTPS. Run `pnpm dev:admin` (port 3003) and exercise login, denied non-admin, signout, expired session, CSRF and cross-domain cookie behavior on a real staging environment.

**This is an authentication foundation only.** No superadmin, fine-grained permissions, moderation endpoints or durable admin audit storage are implemented by this PR. Do not deploy as an operational admin console until native admin E2E and independent security review are complete.
