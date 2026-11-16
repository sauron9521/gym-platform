# Live staging health and device testing

This is a **manual, read-only first stage** toward a real production staging
environment. It does **not** create infrastructure or grant production GO.

1. Provision an isolated staging stack with trusted HTTPS, a disposable
   PostgreSQL instance, Redis, SMTP sandbox, and distinct secrets; never reuse
   production credentials or production user data.
2. Deploy a signed, immutable runtime image from the documented GHCR release
   process. Use the regular forward-only migrations and independent backups.
3. Manually run **Live staging health smoke (manual)** against the explicit
   HTTPS API origin. The workflow checks only GET /health/live and
   GET /health/ready; it never changes data or sends a bearer/cookie token.
4. Run browser authenticated journeys in an isolated staging test account:
   sign-in, create/edit workout, training program assignment, logout.
5. Install a native preview binary on an Android/iOS test device. Run the
   existing `apps/mobile/maestro/flows/auth-smoke.yaml` and
   `apps/mobile/maestro/flows/workouts-smoke.yaml` using **staging-only**
   `APP_ID`, `E2E_EMAIL` and `E2E_PASSWORD` stored privately. Never
   commit these values or pass them to public PR workflows.
6. Test logout/reinstall, 401 refresh, offline startup, and secure-store
   behavior on a real device; record timestamp, image digest, device model,
   tester and pass/fail result outside public CI artifacts.
7. Carry out a separate restore rehearsal and signed two-release rollback
   before any production cutover decision.

A green health-smoke run shows just liveness/readiness for that origin at that
moment. It does not prove real migrations, backup recovery, authentication,
SMTP delivery, device behavior, or rollback. Production remains **NO-GO**.
