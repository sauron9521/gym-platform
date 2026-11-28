# INF05 — Staging edge candidate (inactive)

The [INF01 decision](../../docs/operations/infrastructure-hosting-decision.md)
and [deployment plan](../../docs/operations/full-stack-deployment-plan.md)
already propose distinct staging hostnames. This slice reuses the existing
loopback-only full-stack Compose port contract and production Caddy smoke;
it does not activate a VPS, install Docker or Caddy on a host, create DNS,
issue public certificates or change the production Caddyfile.

| Candidate staging host    | Loopback target |
| ------------------------- | --------------- |
| staging.ovranto.com       | 3002 Landing    |
| app-staging.ovranto.com   | 3000 Athlete    |
| coach-staging.ovranto.com | 3004 Trainer    |
| admin-staging.ovranto.com | 3003 Admin      |
| api-staging.ovranto.com   | 3001 API        |

The staging Caddyfile deliberately uses its local CA and accepts HTTP
requests only from the exact directly connected IPv4 address 127.0.0.1.
The guard precedes redirects and upstream routing. It does not trust
client-supplied forwarding or Cloudflare headers. All other direct
clients receive 403 on known host routes; unknown HTTP hosts receive
421; unexpected TLS names fail certificate/handshake validation.
The local CA is not a publicly trusted certificate and must not be
installed on user devices as a substitute for the live TLS acceptance.
There is no public ACME operation.

The staging environment example has disjoint app/trainer/admin origins
and API JWT issuer, fixed loopback port values and a synthetic SMTP
recipient allowlist. Keep notification dispatch and metrics off.
The remaining secrets and data URLs are deliberately absent. Do not
reuse production credentials, storage, JWT signing keys or issuer.
Cookie host isolation is necessary but not sufficient to establish
environment isolation.

## Verification

Run from repository root with Docker and Node 24:

```sh
node scripts/reverse-proxy-smoke.mjs
node scripts/reverse-proxy-smoke.mjs --staging
```

Both use pinned Caddy and Node images and isolated loopback network
namespaces without published ports. The original production fixture
uses a local-CA copy; the staging test uses the exact candidate.
Verify all five routes, redirects, TLS, sanitized forwarding headers,
host-only cookies, preserved Origin and blocked internal paths. Staging
also binds synthetic client connections to 127.0.0.2 and asserts 403
even when forwarding headers claim the allowed address. All five
production domains are rejected. Full-scope CI runs both smoke modes.
The synthetic upstreams do not prove application authentication,
real proxy IP propagation, DNS or native-device compatibility.

## Before live staging or production

- Obtain explicit staging procurement and deployment authorization.
  Separate Compose project, database, Redis, media and private secret
  files on the separate staging host. Use existing signed image
  promotion and recovery contracts, not source builds on live hosts.
- Choose an operator-approved private access mechanism suitable for
  native testing (e.g. reviewed VPN). Do not broaden the loopback guard
  or enable public ingress as an incidental change. The current
  [INF04 firewall](../security/README.md) allows no web ingress.
- Review exact DNS record names, target addresses, proxy mode, origin
  TLS issuance and renewal, certificate expiry alerts and host firewall.
  Never switch production DNS as part of staging. Staging local CA must
  be replaced with a trusted live TLS configuration before device tests.
- For Cloudflare proxied production, require Full (strict) with a
  validated origin certificate. Review origin network restrictions and
  appropriately scoped Authenticated Origin Pulls or a tunnel before
  routing live traffic. Full (strict) alone does not prevent direct
  origin access. A shared Cloudflare client certificate only proves the
  source belongs to the Cloudflare network, not the OVRANTO zone.
- Verify the direct peer chain (Cloudflare, Caddy, Next rewrites, NestJS)
  before enabling any narrow trusted-proxy ranges. Never trust arbitrary
  forwarded headers. Keep PostgreSQL, Redis, metrics and Docker private.
  Test bypass denial, real login, cookies, rate limits, CSRF and native
  journeys on staging. Record rollback and renewal evidence.

Reference documentation:
[Caddy request matchers](https://caddyserver.com/docs/caddyfile/matchers),
[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/),
[Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/).

No actual Cloudflare configuration or provider ingress has been changed.
Production and Beta remain NO_GO.
