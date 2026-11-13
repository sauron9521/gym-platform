# API production observability — opt-in host monitoring

This operator tooling is ported from `gym-api-nestjs` and adapted for the
`gym-platform` Node 24/pnpm monorepo. **Merging the PR does not deploy
Prometheus, Grafana or Alertmanager; enable host services; connect to production
Docker; or send any alerts.** Review permissions and operating procedures
before manually installing anything.

## Source, privilege separation and lifecycle

The production Compose project is `gym-platform-api`, with an API service
accessible at host loopback `127.0.0.1:3001` by default. Docker Compose
usually creates `gym-platform-api-api-1` as the container name, but confirm
with `docker compose -f infra/docker/compose.prod.yaml ps` using valid
local environment values. Do **not** assume a host container name is stable
across projects, Compose overrides or redeployments.

1. An **operator-controlled, privileged** forwarder reads the API's Docker
   stdout/stderr and publishes sanitized, bounded JSONL snapshots. Only the
   forwarder has Docker API access; never give Docker socket access to
   `gym-monitor` or the API container.
2. The **unprivileged** `gym-monitor` service reads only those snapshots,
   selects the latest five minutes, aggregates whitelisted HTTP status
   and Redis-rate-limiter availability events, and probes
   `/health/live` and `/health/ready`.
3. The exporter publishes only fixed, unlabeled Prometheus metrics into
   node_exporter's textfile collector using atomic replacement, no raw
   logs, URLs, user IDs or credentials.
4. Separate operator-only resource and signal collectors access Docker
   inspect/stats and cgroup v2 to track running state, OOM and CPU throttle
   counters. These collectors also require explicit installation on the
   trusted host.

All four unit/timer pairs in `ops/monitoring/` are examples and remain
disabled by default:

- `gym-platform-api-forwarder` (one-minute, privileged Docker forwarder)
- `gym-platform-api-monitor` (five-minute, no Docker privileges)
- `gym-platform-api-resources` (one-minute, privileged Docker stats)
- `gym-platform-api-signals` (one-minute, Linux cgroup v2 signals)

The templates assume a checkout at `/opt/gym-platform`, restricted config
under `/etc/gym-platform`, and protected sanitized logs under
`/var/log/gym-platform-api`. Provision the host users/groups
`gym-monitor`, `gym-platform-api-logs` and `node_exporter` first.
Limit the log group to sanitized snapshots and prevent untrusted writers.

Copy and review the environment examples
`forwarder.env.example`, `monitoring.env.example`,
`resources.env.example` and `signals.env.example`. Install them as
root-owned files with mode 0600 under `/etc/gym-platform`. Review all
unit paths and required privileges before any manual
`systemctl daemon-reload` or `systemctl enable --now ...timer`.

**Important:** the forwarder and Docker signals collectors are privileged.
Use a dedicated host and a reviewed Docker security boundary. Avoid
mounting the Docker socket into containers just to collect metrics.

## Metric compatibility, alert safety and SLO limitations

Metric names `gym_api_monitor_*`, `gym_api_docker_*` and recording
rules `gym_api:sli:*` retain their original names. They represent
Gym Platform's API in this monorepo, not a separate legacy service.
If old and new services run simultaneously, isolate their Prometheus scrape
targets and labels to prevent series conflation.

`ops/monitoring/alerts.rules.yml` provides alerts for stale/missing
telemetry, readiness/liveness, elevated HTTP 429/503, Redis outages, Docker
OOM/resource pressure and other host signals. Separate
`ops/monitoring/slo.rules.yml` contains **provisional** readiness
observations and HTTP five-minute rolling-window gauges.

These five-minute gauge series are **not monotonic request counters** and
**must not be treated as real request-weighted availability SLOs**. If a
reliable HTTP service SLO is required, independently configure and
authenticate the API's monotonic internal HTTP telemetry endpoint,
scrape it securely, and adopt true-counter/histogram burn-rate rules in
a separately reviewed rollout. This PR does not activate that endpoint,
adopt the old multi-instance SLO governance scripts or set contractual
SLO targets.

An importable dashboard is provided at
`ops/monitoring/grafana/gym-platform-api-overview.json`.
Provide a trusted Prometheus data source at import time. No dashboards
are installed or provisioned automatically.

Do **not** enable alert rules until the collectors actually produce
validated metrics, node_exporter shows no textfile scrape errors and the
Alertmanager test receiver has been verified. A green promtool test proves
alert rule evaluation only, not notification delivery. Backup monitoring
was migrated separately in `docs/backup-restore-operations.md`.

## Offline verification

From the repo root on a Linux host with Node 24 and Docker:

```sh
bash -n scripts/monitoring-forward.sh scripts/monitoring-collect.sh
node --test scripts/monitoring-*.test.mjs
```

The `API Observability` CI job validates monitoring and all four
systemd timer/service pairs, then uses **promtool** with repository
fixtures to validate both the alert and provisional SLO rules.
It does **not** access production containers, issue live notifications,
read real log files or alter server configuration. Real end-to-end
telemetry and alert-delivery drills must be signed off on staging
before cutover to the monorepo.

## Future steps

Staging verification, access-controlled HTTP metrics, multi-instance
telemetry, signed SLO governance and operational runbooks remain future
review items. The standalone `gym-api-nestjs` repository stays operational
source of truth until cutover approval.
