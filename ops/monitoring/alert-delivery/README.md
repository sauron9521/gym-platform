# INF07 — Isolated alert delivery rehearsal

This slice supplements the existing
[production observability guide](../../../docs/operations/production-observability.md)
and HTTPS synthetic observer. It tests delivery, rather than introducing
duplicate collectors or dashboards. It is not live alert configuration.

## Reproduce

From the repository root with Docker on Linux:

```sh
bash ops/monitoring/alert-delivery/verify.sh
```

The fixture uses digest-pinned Prometheus 3.16.0, Alertmanager 0.28.1 and
the existing Node 24 image. Alertmanager 0.28.1 is a locally tested
candidate, not an assertion of current production support or security.
Review supported versions, licensing and security before adoption.

The wrapper copies only the synthetic configuration, test code and
existing alert rules into a temporary directory. It accelerates rule
group evaluation from 30 seconds to 2 seconds without changing
expressions or alert hold durations. All containers share an isolated
network namespace with no external network or published ports, run
nonroot with dropped capabilities and read-only root filesystems,
and use bounded resources and temporary state. No real metrics,
operator addresses, credentials or external receiver endpoints are used.

## Verified behavior

- Validate the Alertmanager configuration with amtool and Prometheus
  configuration and all 30 alert rules with promtool.
- Start real Prometheus, Alertmanager and two local HTTP receivers.
- Expose synthetic healthy samples, then activate the existing
  GymApiDockerOOMKilled (critical) and GymApiRedisOutageObserved
  (warning) rules.
- Verify that the primary receiver accepts both alerts while the
  secondary returns HTTP 503 for the critical alert.
- Recover the secondary and require a successful retry without losing
  the original alert fingerprint. Warnings remain primary-only.
- Observe deduplication for six seconds within the configured repeat
  interval, then resolve the synthetic fault and require resolved
  notifications at the expected receivers.

The local run passed in 21.59 seconds. Full-scope tooling CI runs
the same isolated fixture. Accelerated grouping and repeat settings
are test parameters, not approved incident-response timing.

## Remaining live acceptance

The two receivers are loopback HTTP listeners in a shared test process;
they are not independent infrastructure or human delivery channels.
This proves routing, receiver retry, short-window deduplication and
resolved notification behavior, not high availability, persistent
notification state, provider outages or a delivered owner page.

Before live rollout, review environment-specific alert routing,
severity mapping and receiver credentials. The existing critical and
warning labels are preserved; map them to incident P0/P1 policy with
owner approval rather than treating every warning as P1.
Provision an external observer independent of the application host,
authenticated metric access, private Alertmanager/Grafana access,
retention and protected alert configuration. Test two independent
Telegram/email delivery paths as specified by the approved
[release strategy](../../../docs/product-strategy/release-feature-management-v1.md),
including actual owner receipts, receiver failure, heartbeat/missing
observer detection, recovery notification and an incident stop drill.
Avoid reliance on the application database, API or same SMTP route
for both critical alert paths. Confirm backup/WAL freshness, disk
capacity, PostgreSQL saturation and Redis persistence metrics on real
staging; existing rule evaluation alone does not demonstrate those
measurements. Record evidence against O4, #316, #350 and #351.

No live channels, provider accounts, secrets, DNS or monitoring services
are created or changed. Production and Beta remain NO_GO.
