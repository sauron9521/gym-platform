# Admin readiness dashboard — first verifiable signal

This is a **read-only readiness tile**, visible only after the Next.js
server has independently verified the current cookie session and the
user's `ADMIN` role against the NestJS API.

The server makes a second, unauthenticated, uncached request to the
fixed, private `GYM_API_INTERNAL_URL` at `GET /health/ready`.
The API checks its PostgreSQL connection and throttling storage
readiness; a 200 response with `{ "status": "ok" }` displays a
healthy signal. All other responses, network errors or invalid
upstreams display degraded state without exposing internal URLs.

The page uses existing English and Ukrainian `next-intl` messages.
No client-side fetch, cookie forwarding or credential exposure is
needed for the readiness tile. The page remains dynamically rendered.

**Important limitations:** readiness is a point-in-time check, not
service uptime, latency, revenue, account statistics or business
activity metrics. It does not verify Mobile, Web, Landing or Admin
availability independently. It does not provide moderation CRUD.

Before launching privileged admin operations, design persisted RBAC
delegation, tamper-resistant audit storage, authorization tests and
reversible admin workflows. Existing operator allowlist and structured
logging are foundations, not those completed requirements.
