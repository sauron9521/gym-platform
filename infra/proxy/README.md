# DEP07 — Caddy edge candidate (not deployed)

The proposed host-level Caddyfile targets the existing loopback-only Compose
ports. It is a reviewable pilot, not an owner approval of Caddy or a live
deployment. Only the five approved production hosts are routed.

| Host              | Loopback target |
| ----------------- | --------------- |
| ovranto.com       | 3002 Landing    |
| app.ovranto.com   | 3000 Athlete    |
| coach.ovranto.com | 3004 Trainer    |
| admin.ovranto.com | 3003 Admin      |
| api.ovranto.com   | 3001 API        |

HTTP requests to allowed hosts redirect to HTTPS; other HTTP hosts receive 421. Strict SNI/Host checking rejects mismatched HTTPS requests. Internal
metrics paths are denied at the edge, including through the web backend
prefix. Keep API token authorization and metrics disabled by default;
proxy path filtering is defense in depth, not authorization. Origin and
host-only cookies are preserved, not rewritten. Forwarded headers are reset
to the directly connected peer; Cloudflare-specific client IP headers are
not trusted. No blanket trust of Docker subnets or arbitrary forwarding.

The sample environment aligns public HTTPS origins with API configuration.
Do not copy it as a live secret file. Before any actual rollout, explicitly
review the exact direct peer addresses seen by NestJS (including Next.js
rewrites), configure narrow trust only where proven, and verify rate limits
and session/CSRF behavior. The smoke does not prove client-IP propagation
through multiple proxies. If Cloudflare is selected, use Full (strict),
verified origin certificates, controlled origin access and reviewed IP
ranges; never Flexible or a permissive forwarded-header policy.

## Offline verification

From repository root (Docker and Node 24):

```bash
node scripts/reverse-proxy-smoke.mjs
```

The runner validates the candidate using a pinned Caddy 2 image, then runs
a temporary local-CA variant and five synthetic upstreams in a shared
network namespace with no external networking or published ports. It
verifies certificate trust, host routes, unknown hosts, HTTP redirects,
header sanitation, cookie and Origin transport, and private path denial.
No public ACME request, real DNS, external TLS certificate, live traffic,
real authorization or deployment is involved. Containers and local CA are
discarded. DEP09 must verify the real HTTPS edge and renewal/expiry alerts.

Use the existing full-stack Compose configuration unchanged; release
promotion and signed images remain DEP08. See the
[full-stack plan](../../docs/operations/full-stack-deployment-plan.md).

For the separate inactive staging candidate, see [INF05 staging edge](staging-edge.md). Production routing is unchanged.
