# Gym Platform Admin — protected foundation

This is a **minimal and deliberately read-only** Next.js 16 administrative shell on port 3003.
Every page request forwards only the incoming cookie to the fixed NestJS API origin
and checks the actual `ADMIN` role. A client-side role flag is never enough.

Start locally with `pnpm dev:admin` and a trusted `GYM_API_INTERNAL_URL` in
`apps/admin/.env.local`. There is **no admin-specific sign-in flow yet**;
a separate production subdomain does not inherit the Web host-only session
cookie. Do not deploy this scaffold as an operational admin console.

Missing: admin sign-in/session domain setup, SUPERADMIN and granular permissions,
moderation CRUD, audit-log storage, dashboard metrics, end-to-end tests.
