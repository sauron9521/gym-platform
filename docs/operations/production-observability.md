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
pnpm test:tooling scripts/monitoring-
```

The `API Observability` CI job validates monitoring and all four
systemd timer/service pairs, then uses **promtool** with repository
fixtures to validate both the alert and provisional SLO rules.
It does **not** access production containers, issue live notifications,
read real log files or alter server configuration. Real end-to-end
telemetry and alert-delivery drills must be signed off on staging
before cutover to the monorepo.

## Collector replacement review (2026-11-24)

The first consolidation shares only atomic publication between the two trusted
Docker metrics collectors. Their fixed filenames, directory/target validation,
0640 temporary files, flush/rename, error messages and stale-on-failure
semantics remain unchanged. The log snapshot and unprivileged textfile
publishers have distinct trust contracts and are intentionally not merged.

| Candidate                                                                                 | Potential replacement                                                                                       | Decision                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [cAdvisor](https://github.com/google/cadvisor/blob/master/docs/storage/prometheus.md)     | CPU, memory, CFS counters, OOM metrics                                                                      | First resource shadow candidate; retain Docker inspect/events semantics until verified |
| [Grafana Alloy](https://grafana.com/docs/alloy/latest/monitor/monitor-docker-containers/) | cAdvisor exporter and Docker log collection in one agent                                                    | Evaluate alongside standalone cAdvisor; not an additional mandatory agent              |
| [Vector](https://vector.dev/docs/reference/configuration/sources/docker_logs/)            | Docker log ingestion and [VRL filtering](https://vector.dev/docs/reference/configuration/transforms/remap/) | Alternative log collector; append/stream output is not the atomic snapshot contract    |
| [Fluent Bit](https://docs.fluentbit.io/manual/data-pipeline/filters/log_to_metrics)       | Log ingestion and metric conversion                                                                         | Defer; another agent is not justified before parity                                    |

cAdvisor CPU counters and memory gauges do not automatically reproduce Docker
CLI percentage formulas, stopped-container sentinels, restart counts or the
bounded ten-minute Docker OOM event window. Never substitute missing series
with zero. Alloy's Docker log source uses stored positions, unlike the current
full ten-minute snapshot rebuilt each minute. A streaming collector must
demonstrate equivalent handling of restarts, rotation, clock skew, malformed
logs and failure freshness before cutover.

Pilot on a disposable Linux/cgroup v2 test host only. Use synthetic HTTP status
and Redis transitions, repeated collection, restart/stop and controlled
resource fixtures; compare exact event counts, metric types, timestamps and
alert evaluations, and bound resource cost/cardinality. Require an allowlist
before any raw log leaves the privileged boundary, no raw logs in buffers,
diagnostics or sinks, and no Docker socket for the API or gym-monitor. A
read-only mount of the Docker socket does not enforce a read-only Docker API.
Review privileges and pinned agent versions separately. Keep shadow metrics
isolated from existing alerts and dashboards, and require human staging
approval before any service installation or cutover.

No candidate agent was installed or exercised in this refactor; no measured
collector parity or production readiness is claimed.

## Resource collector shadow pilot design (2026-11-24)

Reviewed main [`26f3d63`](https://github.com/sauron9521/gym-platform/commit/26f3d63d06edb3b682f09a8ab521447dfd40ece1)
after #803. This is a design/evidence gate under #711, not an installation
or cutover. The production Compose contract currently limits the API to
2 CPUs, 1 GiB memory and 256 PIDs.

Prefer evaluating Alloy's embedded cAdvisor first, rather than deploying
two permanent agents. Standalone cAdvisor is a fallback if Alloy's
integration cannot satisfy the boundary or resource budget. Consult the
[cAdvisor metric catalog](https://github.com/google/cadvisor/blob/master/docs/storage/prometheus.md)
and [Alloy exporter reference](https://grafana.com/docs/alloy/latest/reference/components/prometheus/prometheus.exporter.cadvisor/).
These are upstream capabilities, not evidence from a running candidate.

### Exact mapping and non-equivalences

| Existing series suffix (prefix `gym_api_docker_`)           | Candidate cAdvisor source                                                    | Acceptance decision                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `cpu_percent`                                               | `container_cpu_usage_seconds_total` rate multiplied by 100                   | Compare CPU cores, not percentage of quota; align the observation windows; avoid double-counting total and per-core series |
| `memory_percent`                                            | `container_memory_working_set_bytes` and `container_spec_memory_limit_bytes` | Compare Docker CLI cache subtraction on cgroup v2; require a positive finite known limit                                   |
| `pids`                                                      | `container_threads` or cgroup PID count                                      | Unproven; processes alone are not PIDs/tasks; retain Docker stats until proven                                             |
| `cpu_periods_total`                                         | `container_cpu_cfs_periods_total`                                            | Compare against the exact container's cgroup counter                                                                       |
| `cpu_throttled_periods_total`                               | `container_cpu_cfs_throttled_periods_total`                                  | Compare raw counts and reset behavior                                                                                      |
| `cpu_throttled_seconds_total`                               | `container_cpu_cfs_throttled_seconds_total`                                  | Compare seconds, not microseconds                                                                                          |
| `oom_events_window_10m`                                     | `container_oom_events_total`                                                 | Not equivalent to Docker's bounded event history; retain existing sampler                                                  |
| `running`, `signals_running`, `restart_count`, `oom_killed` | No proven equivalent                                                         | Keep Docker inspect; absent cAdvisor series do not establish stopped/OOM state                                             |
| Both `last_sample_timestamp_seconds` series                 | Scrape status and sample timestamp                                           | Retain current freshness contract; successful scrape is not fresh per-container data                                       |

The existing alerts use CPU >=180%, memory >=90%, PID >=230,
three restarts in ten minutes and a throttled-period ratio >=20%.
These are current rules, not new pilot thresholds. Keep them unchanged.
A stopped container currently emits -1 resource gauges and no CPU
counters; missing candidate data must never be synthesized as healthy zero.

### Isolated pilot sequence and privacy gate

1. Provision a disposable Linux cgroup v2 VM with its own Docker daemon,
   no production credentials, no real user data and no unrelated workloads.
   Pin an audited Alloy release and image digest, record kernel, engine
   and cgroup versions, and keep the candidate listener local/private.
   The current developer device has Docker 29.10.0 and cgroup v2, but is
   not established as a disposable host.
2. Start one synthetic container and one decoy container with a distinct
   identity and fake sensitive labels. Apply equivalent CPU, memory and
   PID limits to the fixture. Do not reuse the production Compose project
   or mount its configuration/data. No live OOM test on a shared host.
3. Use only Alloy's cAdvisor component for the first pilot. Configure
   `docker_only = true`, `disable_root_cgroup_stats = true`,
   `store_container_labels = false` and an explicit minimal label
   allowlist for fixture selection; leave the environment allowlist
   empty. Restrict metric kinds to CPU, memory and the specific additional
   kinds needed by the experiment. These are design requirements, not
   an executable configuration. Verify the selected version supports them.
   The agent still has host-sensitive privileges: never mount its Docker
   socket into the API or gym-monitor, or treat a read-only socket mount
   as an authorization boundary.
4. Use a separate Prometheus instance/TSDB and job for shadow samples.
   Filter by the exact fixture identity before retaining data, allowlist
   metric names, retain only bounded fixture identity labels needed for
   distinguishing counter resets, and exclude image names, host paths,
   environment metadata, arbitrary labels and decoy series. Never forward
   the raw exporter to a remote sink. Check actual emitted labels and
   diagnostic logs for fake sensitive values. No Loki/log pipeline in
   this first resource pilot.
5. Initially use a fixed 15-second housekeeping and scrape interval, and
   sample existing one-shot collectors once per minute in isolated output
   directories. These are proposed exploratory settings, not approved
   production intervals. Compare aligned samples rather than treating
   different windows as interchangeable.

### Evidence to collect before a replacement PR

| Fixture case                            | Required evidence                                                         |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Idle and bounded CPU activity           | CPU units, time windows, per-core labels and observed differences         |
| Bounded memory activity                 | Cache accounting, configured memory limit and percentage differences      |
| Controlled thread/process activity      | PID/task equivalence or explicit unsupported result                       |
| CPU quota pressure                      | CFS counters, throttling ratio and existing alert decision                |
| Stop, restart and recreate              | Missing versus zero, per-container identity and resets, no false recovery |
| OOM on disposable fixture only          | OOM counter behavior; do not replace Docker event history without proof   |
| Failed scrape or stale collection       | Missing/stale remains unknown; prior snapshots and alarms remain valid    |
| Decoy container and fake private labels | No unrelated samples or private fields in retained data                   |

Capture at least three independent runs with timestamps, pinned versions,
fixture limits and identity, reference/candidate samples, differences,
missing series, resource overhead (agent CPU/RSS, scrape samples and storage)
and alert agreement. Agree numerical tolerances and resource budgets after
initial observations and before any cutover claim. Keep raw captures local
to the disposable fixture and publish only sanitized summaries. Document
unsupported metrics explicitly; do not relabel new metric types as old ones.

A first implementation PR may add a pinned isolated pilot configuration
and offline Prometheus fixture tests only. A subsequent actual pilot must
produce the above evidence. Keep old services, alerts and dashboards
active/unchanged; rollback is simply removal of the isolated pilot.
No agent is installed, started or configured by this design PR. There is
no measured parity, host privilege review or production approval.

### Offline configuration checkpoint

The isolated resource pilot now has an executable configuration in
[config.alloy](../../ops/monitoring/shadow/config.alloy), a separate
[Prometheus configuration](../../ops/monitoring/shadow/prometheus.yml),
[recording rules](../../ops/monitoring/shadow/shadow.rules.yml) and
[synthetic rule tests](../../ops/monitoring/shadow/shadow.test.yml).
No service unit, production Compose file, workflow or existing alert is
changed. Do not start the collector on a shared developer or production host.

The reviewed validator image references are immutable. The November 25
2026 security scan (Trivy 0.69.3, linux/amd64, vulnerability database
updated November 24 at 19:04 UTC) compared the previous pins with the
new ones. Alloy 1.22.0 reduced Critical/High findings from 5 to 0;
Prometheus 3.16.0 reduced them from 110 to 2 (one distinct High finding,
CVE-2026-78661 in x/net, reported in both binaries). Node 24 Alpine
remains pinned, with six High findings in brace-expansion and undici;
the Debian slim alternative had 56 High findings. Counts are scanner
findings, not evidence of exploitability. The updated Prometheus pin is
also used for the existing offline CI rule checks. Native validation
passed for the shadow configuration and all four rule suites. No live
collector ran. Signature/provenance, transitive licenses, residual
vulnerability reachability and privileged runtime review still require
approval before a dispatch. These pins are not production approval.

- Alloy: `grafana/alloy:v1.22.0@sha256:9acc2529bc1edb7f5b2bd801dd8334ebc80c158e3a9e5526ecd7c9a273d43189`.
- Prometheus: the same digest already used by the repository's API
  Observability CI, `prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06`.

The Alloy pipeline restricts input to a synthetic fixture with Docker label
`gym_shadow_fixture=resource-v1` and exact container name
`gym-resource-shadow-fixture`. It requires a recognized Docker cgroup ID,
keeps only the listed native series and total CPU (or an unlabeled total),
and strips all other labels before remote write. The full synthetic cgroup
identity is retained to distinguish recreation. Other cgroup layouts fail
closed until explicitly reviewed. Only the local receiver
`http://127.0.0.1:19090/api/v1/write` is configured. Prometheus has no scrape
targets or notification receiver. The separate `gym_shadow:` recording
rules are exploratory CPU, memory and throttling calculations, not production
aliases or alerts; normal Prometheus lookback can retain a previous value.
Per-container freshness, runtime label redaction, cardinality, resets and
alert equivalence still need live fixture evidence.

The scrape interval is 15 seconds. The previous Alloy 1.21.0 validator rejected the
newer documentation's `housekeeping_interval` and
`allow_dynamic_housekeeping` arguments, so the configuration deliberately
keeps the internal housekeeping defaults across the update. Measure actual collection
timestamps in the live pilot rather than assuming 15-second housekeeping.

Validate from the repository root, using containers without runtime host
mounts, Docker socket or network:

```sh
alloy=grafana/alloy:v1.22.0@sha256:9acc2529bc1edb7f5b2bd801dd8334ebc80c158e3a9e5526ecd7c9a273d43189
prom=prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06

docker run --rm --network none --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  -v "$PWD/ops/monitoring/shadow:/shadow:ro" \
  --entrypoint /bin/alloy "$alloy" validate /shadow/config.alloy

docker run --rm --network none --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  -v "$PWD/ops/monitoring/shadow:/shadow:ro" \
  --entrypoint /bin/promtool "$prom" check config /shadow/prometheus.yml

docker run --rm --network none --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 \
  -v "$PWD/ops/monitoring/shadow:/shadow:ro" \
  --entrypoint /bin/promtool "$prom" test rules /shadow/shadow.test.yml
```

The temporary filesystem is needed for promtool's test TSDB. The synthetic
tests cover 100% CPU (one core), 50% memory, a 25% throttling ratio,
exclusion of per-core data and other jobs, missing data and zero
denominators. Fuzzy comparison permits only last-bit floating-point
differences in rule results; it is not a measured collector tolerance.

These offline commands passed on the developer device; the two validator
images were pulled, but no telemetry service ran. Live collection requires
a separately approved disposable VM, a private receiver on
`127.0.0.1:19090` with remote write enabled, isolated Alloy storage and TSDB
directories and reviewed runtime privileges. Disable Alloy usage reporting
for the actual pilot and block outbound traffic. The version pins are
reproducibility anchors, not a completed supply-chain or license approval.
Do not install a service or open a listener based on this checkpoint alone.

### Fixture and comparison procedure

The opt-in [fixture Compose file](../../ops/monitoring/shadow/fixture.compose.yml)
contains only two synthetic Node containers, not a collector. Both use a
digest-pinned image, 2 CPUs, 1 GiB RAM with no extra swap allowance, 256 PIDs,
a non-root user, read-only filesystem, dropped capabilities and no network
or host mounts. The decoy deliberately shares the fixture selection label
but has a different name. All private label/environment values are fake
sentinels. No production data or secrets are required.

**Runtime gate:** execute the following procedure only in an owner-approved
disposable Linux VM with a fresh local Docker daemon, cgroup v2, sufficient
capacity, no unrelated containers, no host sharing or real credentials,
reviewed collector privileges and image/license/security review. Check
the Docker context and daemon identity explicitly; a VM detection check
alone is insufficient. Preload reviewed image digests before blocking
outbound traffic. Do not use an SSH or remote production Docker context.
The developer machine is not an approved VM.

#### Fixture preparation and validation

From the repository root:

```sh
fixture=ops/monitoring/shadow/fixture.compose.yml
docker compose -f "$fixture" --profile resource-shadow config --quiet
docker compose -f "$fixture" --profile resource-shadow config --format json
```

The second command exposes only synthetic configuration. Review both
containers, resource limits, absence of mounts/ports/network and image
digest. This command needs no fixture startup and is suitable for offline
validation. On the approved VM only, with both names unused:

```sh
docker compose -f "$fixture" --profile resource-shadow up -d --pull never
docker compose -f "$fixture" --profile resource-shadow ps
```

Use a separate local Prometheus instance with the pinned binary/config
from the preceding checkpoint, `--web.listen-address=127.0.0.1:19090`,
`--web.enable-remote-write-receiver`, a new private TSDB directory
(`--storage.tsdb.path`) and bounded retention
(`--storage.tsdb.retention.time=1d`). Start Alloy with its pinned binary,
`run --disable-reporting --server.http.listen-addr=127.0.0.1:12345`,
a fresh private `--storage.path` and the shadow config. The exact native
runtime permissions/installation method must pass the VM review before
starting; do not weaken the API or monitor service permissions to run it.
No systemd installation, production scrape target or external remote
write receiver is part of the experiment. Check loopback bindings and
keep outbound traffic blocked.

#### Paired observations

Create a new private evidence directory for each independent run:

```sh
umask 077
evidence=$(mktemp -d)
date -u +%FT%TZ > "$evidence/start.txt"
uname -r > "$evidence/kernel.txt"
docker version --format '{{.Server.Version}}' > "$evidence/docker.txt"
docker inspect --format '{{.Id}}' gym-resource-shadow-fixture \
  > "$evidence/fixture-id.txt"
```

After at least two minutes of warmup, record a timestamp immediately before
and after each paired observation. Use a new subdirectory per observation
so the one-shot collectors never overwrite prior evidence:

```sh
sample=$(mktemp -d "$evidence/sample.XXXXXX")
date -u +%FT%TZ > "$sample/before.txt"
RESOURCE_CONTAINER=gym-resource-shadow-fixture \
  RESOURCE_TEXTFILE_PATH="$sample/gym_api_docker.prom" \
  node scripts/monitoring-docker-resources.mjs
SIGNALS_CONTAINER=gym-resource-shadow-fixture \
  SIGNALS_TEXTFILE_PATH="$sample/gym_api_docker_signals.prom" \
  node scripts/monitoring-docker-signals.mjs
date -u +%FT%TZ > "$sample/after.txt"
```

Run the reference commands with the reviewed host permissions. Use
the recorded UTC timestamp and the exact fixture cgroup ID to query the
private Prometheus API (`/api/v1/query` with explicit `time`, and
`/api/v1/query_range` for the aligned observation window). Retain the raw
allowlisted native metrics, the three shadow rule values, sample timestamps
and `container_last_seen`. A successful query or fresh recording rule alone
does not prove fresh exporter samples. Compare the fixture ID with the
allowed cgroup ID form, never combine old and recreated container series.
Check `/api/v1/series` for all retained labels/series, the decoy ID and
fake private sentinels; inspect the local agent diagnostics separately.
Keep captures private and never upload raw responses or logs.

Use a foreground terminal for a bounded workload while taking samples in
another terminal. These example loads run for 90 seconds and terminate:

```sh
# One busy CPU thread.
docker exec gym-resource-shadow-fixture node -e \
  'const end=Date.now()+90000; while(Date.now()<end) {}'
# Touch 256 MiB; the Node process also has its own runtime overhead.
docker exec gym-resource-shadow-fixture node -e \
  'const b=Buffer.alloc(256*1024*1024,1); setTimeout(()=>console.log(b[0]),90000)'
```

Collect idle, CPU and memory observations separately, with recovery
windows between loads. Sample raw CPU counters and align the candidate
rate window with reference timing; do not assume one-shot Docker stats
and a one-minute Prometheus rate are identical. For memory, compare
working set/cache subtraction and configured limit, not the workload
allocation size alone. Record PID/task differences, CFS counts and units,
missing data, stop/restart/recreate identity, counter resets and stale
collection. Stop and restart only the named synthetic fixture; use Compose
`up --force-recreate` for a new fixture identity. Quota pressure,
controlled multi-thread and OOM cases remain separate bounded experiments
on the approved disposable VM. Do not perform OOM testing on a shared host.

#### Evidence and cleanup

Repeat the sequence at least three independent times. For every observation,
record fixture state/ID, time interval, reference and candidate values,
candidate last-seen time, difference or unsupported/missing reason, and
whether the corresponding existing alert would agree. Record agent CPU/RSS,
series count and TSDB disk usage separately. Mark comparison as
inconclusive if data are absent, stale, misaligned or of differing units.
A documented observed difference is not a failure tolerance. Do not claim
parity or remove a script until the evidence and numerical tolerances
are reviewed. Use the evidence cases listed above, including the decoy
privacy check, before a replacement decision.

Stop only the explicitly started pilot processes, then remove only the
fixture project with:

```sh
docker compose -f "$fixture" --profile resource-shadow down
```

Retain sanitized evidence for owner review; dispose of the VM and its
private TSDB/Alloy storage afterward. Do not run Docker-wide prune, modify
existing services or stop unrelated containers.

This checkpoint was validated with Docker Compose configuration rendering
and assertions for the two services, names, limits, digest and absence of
host access. No fixture, workload or live telemetry process was started;
the attached developer host is bare metal and no disposable VM was
confirmed. Actual paired observations and the runtime approval remain
blocked. The current monitoring scripts and alerts remain authoritative.

### Manual hosted-VM observation

The [manual resource shadow workflow](../../.github/workflows/monitoring-resource-shadow.yml)
is an advisory, opt-in experiment, not a PR check or a deployment. It runs
only from main on a GitHub-hosted Ubuntu 24.04 runner and requires the
explicit `APPROVE_DISPOSABLE_RESOURCE_SHADOW` choice (default is
`DO_NOT_RUN`). Before approval, review the pinned image versions, licenses,
vulnerabilities and privileged access described above. No repository or
production secrets are provided, checkout credentials are not persisted,
and the job rejects a remote Docker context or a nonempty daemon.

The workflow preloads the pinned images, then starts the synthetic fixture
and decoy, an isolated Prometheus receiver and Alloy in the receiver's
network namespace. Neither exposes a host port; ordinary container network
traffic has no external route. Alloy nevertheless has privileged host
access, including the Docker socket and read-only host mounts, so this is
not a security sandbox for an untrusted agent. This is acceptable only
on the disposable hosted VM after explicit approval. Usage reporting is
disabled. No existing production services, gates or alerts are changed.

One dispatch attempts three paired observations (idle, CPU, memory).
The [evidence sanitizer](../../scripts/monitoring-shadow-evidence.mjs)
rejects unexpected series, container identities, labels and nonfinite
values, and refuses to report differences for missing or stale candidate
data. It checks the fixture ID, bounded observation interval and exact
query evaluation time. A separate diagnostic sentinel check is required.
Only fixed metric names, numeric measurements and phase/status metadata
are uploaded for seven days; raw queries, labels, container identities
and diagnostics are never uploaded. An absent report or an inconclusive
run is not a successful comparison. The workflow is bounded to 15
minutes and cleans up its named resources without a daemon-wide prune.

The first hosted run with updated images (45501567658) completed the
workloads but rejected the final evidence. The original generic error
did not identify the violated contract, and no artifact was published.
Phase progress and early per-sample validation now report only fixed
stage and error codes, never raw labels, identities, sample values or
diagnostics. A structural failure stops before the next workload;
missing or stale data remains inconclusive. Final validation of the
complete series history and sentinel check remains mandatory. This
diagnostic change does not establish the root cause of the first
rejection or authorize relaxing the privacy allowlist.

The subsequent hosted run (45503665424) rejected the idle sample with
`SHADOW_JOB_MISMATCH`. The scrape job name alone is not sufficient to
override an exporter target's job label. The relabel stage now assigns
the constant `gym-resource-shadow` job after the fixture identity, metric
and CPU filters, before the final label allowlist. The evidence validator
and recording rules retain their original strict job contract. This
does not admit additional container identities or metrics.

A successful workflow run still means exploratory observations, not
parity. Repeat at least three independent dispatches and separately
exercise restart, recreate, throttling, PID, OOM, failure freshness and
resource overhead before deciding on replacement. No OOM workload runs
in this workflow. The first hosted run has not yet occurred at this
checkpoint; review actual output and agree tolerances before cutover.

## Future steps

Staging verification, access-controlled HTTP metrics, multi-instance
telemetry, signed SLO governance and operational runbooks remain future
review items. The standalone `gym-api-nestjs` repository stays operational
source of truth until cutover approval.
