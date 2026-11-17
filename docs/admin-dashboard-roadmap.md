# Administrator dashboard — first verifiable signal

The private dashboard displays **NestJS readiness only**, not fabricated user counts, revenue, activity, moderation events or service uptime. The Admin server verifies the signed-in user first, then makes an uncached request to `/health/ready`. Any failure renders a degraded status without leaking infrastructure details.

Moderation of exercises/categories/accounts is **not implemented** in this PR. Before enabling any admin write operation, implement durable RBAC delegation, append-only audit storage, tested authorization failure modes and confirmation UI. Never connect operator permissions directly to untrusted browser flags.

Native mobile readiness and release observability remain independent of this dashboard.
