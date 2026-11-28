# Production reliability foundation (#922 / #923)

This slice prepares a bounded single-instance API and adds selected
multi-instance regression evidence. It does not authorize deployment or
horizontal scaling.

## PostgreSQL connection budget

Prisma's installed adapter uses node-postgres pools. The previous defaults
were 10 connections, 10 seconds idle, and no connection/acquisition deadline.
The API now validates the following process-local settings:

| Setting                          | Default |     Allowed |
| -------------------------------- | ------: | ----------: |
| DATABASE_POOL_MAX                |      10 |        1–50 |
| DATABASE_POOL_CONNECT_TIMEOUT_MS |    5000 |   250–30000 |
| DATABASE_POOL_IDLE_TIMEOUT_MS    |   10000 | 1000–120000 |

The connection timeout bounds pool acquisition and connection establishment;
it is not a SQL statement timeout or Prisma transaction deadline. The UTC
on-connect hook remains intact. The adapter owns and closes its own pool.
A structured startup event reports the configured capacity and timeouts
without connection strings. It does not report live pool utilization.

Budget conservatively: API replicas × pool maximum, plus dedicated auth
cleanup lock clients (up to one per running replica), migration clients,
future workers, administrative/monitoring clients and provider headroom.
For example, two APIs at 10 each + two lock connections + three reserved
for migration/maintenance + five for future worker capacity + ten spare
requires at least 40 available application connections. These are planning
allowances, not measured production demand. Compare with the managed
database's actual usable limit after reserved slots and other tenants;
start at one replica. Do not use transaction-mode PgBouncer for the
session-level advisory lock connection.

Measure pool waits/saturation, PostgreSQL active/idle connections, query
latency and HTTP 5xx/429 under representative read/write load before changing
capacity. Request-scoped driver-call timing is available below. Live pool gauges,
measured slow-query thresholds and targeted indexes remain follow-up
evidence (#316); no speculative indexes or PgBouncer.

## Redis and dependency health

Configured Redis stays fail closed; the local memory backend is only for
single-instance mode with no Redis URL. Connection and command deadlines
are two seconds. Disable automatic resend of unanswered commands after
reconnection, because a lost response does not establish whether the Lua
increment ran. A timeout can still consume quota; do not retry blindly.

Liveness is dependency-free. Readiness checks PostgreSQL and Redis, shares
one outstanding probe with a five-second deadline and returns generic 503
on failure or during shutdown. A timed-out query is not cancelled; the
negative result remains until the dependencies settle. No accumulating
queries or automatic local fallback. Existing safe Redis transition logs
and request IDs remain available.

## Lifecycle and scheduled work

Keep the Prisma pool alive through scheduler stop and HTTP drain; close it
in application shutdown. Redis already disconnects in application shutdown.
The installed scheduler awaits running cron callbacks configured with
waitForCompletion. Both auth retention and avatar cleanup now opt in.
The container's existing 30-second stop grace period is not a guarantee
that every request or job will finish; verify under actual deployment load.

Auth retention uses an existing separate session advisory lock with bounded
batching. Avatar cleanup is non-overlapping within one process; a global
lock is deliberately not added while replicas may have separate local disk
namespaces. Shared media storage and safe distributed avatar maintenance
remain prerequisites for multi-replica deployment (#921/#923). Outbox
dispatcher and worker leases are implemented for in-app delivery in #569
behind a default-off flag; external delivery remains deferred.

## Regression evidence and remaining gates

The tests exercise actual PostgreSQL pool saturation/recovery and UTC,
HTTP drain, two Nest AppModule instances with shared Redis and PostgreSQL
for quotas and session revocation, Redis client disconnect/recovery,
existing advisory lock contention, and health timeout/shutdown behavior.
The account-quota test isolates its outer IP guard. These instances run
in one test process, not two production containers. No production secrets,
deployment, actual load baseline, host failure, independent process kill,
shared-media acceptance or backup/restore drill is claimed.

Retain #922/#923 pending deployment-specific budget and remaining
multi-instance scenarios (including write idempotency and storage).
Actual staging, restore and rollback evidence remains in #351; Beta
readiness and explicit approval remain #352.

## Request-scoped database timing (#316)

The HTTP completion and abort logs now include five fixed numeric
fields, correlated with the existing server-generated request ID:

| Field                  | Meaning                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| databaseCallsStarted   | Adapter queryRaw/executeRaw calls started while the HTTP scope is active |
| databaseCallsCompleted | Such calls settled before the response finished or closed                |
| databaseCallsFailed    | Completed calls that rejected                                            |
| databaseCallTotalMs    | Sum of completed adapter call wall times, rounded to 0.01 ms             |
| databaseCallMaxMs      | Longest completed adapter call wall time, rounded to 0.01 ms             |

Use Node AsyncLocalStorage to carry only a fixed-size accumulator;
instrument the installed PrismaPg adapter's queryable methods on the
pool adapter and returned transaction. There is no global SQL-event
correlation, SQL/parameter/result/error inspection, new log event,
request ID metric label, or change to the existing HTTP response.
Unscoped cron and detached operations after response settlement are
not included. The response snapshot is immutable after settlement.
The adapter contract must be regression-tested when Prisma is upgraded.

These are diagnostic **driver-call timings**, not SQL statement counts,
PostgreSQL execution-plan timings or a complete DB trace. Calls can
include pool acquisition, conversion and transaction control such as
COMMIT; initial connection/BEGIN/isolation setup, direct pg clients,
migration scripts and connection disposal are outside the measured
methods. Parallel calls can make the sum larger than HTTP wall time.
A shared single-flight operation is attributed to the async scope
that actually starts it, not every waiting request. In-flight calls
that have not settled at disconnect are counted as started only.
Zero counts do not prove that a request performed no indirect DB work.

The longest call identifies candidates for investigation alongside
the existing safe request/exception logs; no raw statement fingerprint
or guessed slow-query threshold is emitted. Do not use these fields as
an alerting SLO or derive indexes from them alone. Measure overhead,
pool saturation, query templates and EXPLAIN before/after on the same
synthetic staging fixture. No indexes, additional telemetry libraries,
new metric cardinality or production activation decision in this slice.

### DEP10b — explicit connection budget and local evidence

Use the dependency-free planner with a reviewed JSON file containing only
numeric capacity and reservation inputs (never connection URLs):

```sh
node scripts/database-connection-budget.mjs ops/database/connection-budget.example.json
```

The example is illustrative, not approved production capacity. Obtain actual
server limits from PostgreSQL/provider documentation, including
`max_connections`, `superuser_reserved_connections`, PostgreSQL 17
`reserved_connections`, role `rolconnlimit` and database `datconnlimit`
(-1 means unlimited). Provider-reserved slots are additional non-overlapping
reservations. Account for other concurrent clients as an explicit
conservative allowance, without counting the same connections twice.
Use the most restrictive server, role and database limits; the planner
conservatively charges all planned clients against that minimum even if
some use other roles. Do not interpret privileged-role exemptions as spare
capacity. For rolling upgrades include overlapping old/new replicas in
the peak API replica count. Worker allowance is a total planned maximum,
not activation of workers. A zero worker allowance is explicit and means
no separate worker connections are permitted by that plan.

The calculation charges one extra dedicated auth cleanup connection per API
process and explicit migration, maintenance and spare allowances. The
example has 97 usable slots, 31 budgeted for one API and 42 for two.
A positive remaining budget is not approval to scale; the computed
maximum is an arithmetic upper bound, not a load-test recommendation.
Exit 0 means the plan fits, 1 means over budget, and 2 means invalid input.
Unknown provider or concurrency limits must be resolved before an operator
uses the planner for staging/production. No automatic configuration change,
database connection, or infrastructure provisioning is performed by the CLI.

The disposable full-stack rehearsal reads the actual PostgreSQL 17 limits
and the resolved API pool maximum, counts other client sessions in its
fresh database (excluding the observation connection), validates a one-API
plan and rejects a hypothetical over-budget plan. It emits only numeric
capacity evidence, never query text, addresses or credentials. The observed
count is a point-in-time sample, not a saturation measurement. Existing
Prisma integration tests cover acquisition timeout/recovery and UTC.
Realistic concurrent load, peak connection use, p95/p99 acquisition and
request latency, migration/worker overlap, provider restrictions and
two-container acceptance remain separate evidence under #922/#923.

### DEP10d — bounded opt-in k6 load profile

Run from an independent checkout with Docker and Node 24:

```sh
node scripts/full-stack-rehearsal.mjs --load
```

The default required CI rehearsal and signed staging workflow remain
unchanged. This opt-in source-built rehearsal runs a separate pinned
upstream k6 executable in a disposable internal network, after HTTPS,
Redis failure/recovery and synthetic monitoring checks, before recovery.
There is no user-supplied origin, account, token, external load generator
or rate-limit bypass. k6 is a test-only upstream image, not linked into
the application or redistributed in the production image. Review its
AGPL-3.0 license and upstream image security before broader adoption.
Autocannon and the existing sequential/API A/B baseline are unchanged.

The nine anonymous GET routes are the same fixed readiness/liveness,
public page and rewrite probes used by the synthetic observer. The
profile runs 15 seconds at 5 requests/s (one VU), followed by a five-second
gap and 15 seconds at 20 requests/s (four VUs). One iteration makes one
request; at least 75 and 300 requests must complete with HTTP 200 and zero
dropped iterations. The arrival scheduler may include one extra iteration
per phase at the time boundary (76 and 301 maximum). TLS is validated against the disposable Caddy CA;
redirects are rejected. The latency percentiles (p50/p95/p99/max) are
k6 request-duration values, not the existing sequential fetch wall-clock
contract. They are exploratory observations, not production SLO gates.
There is no warmup exclusion within the two phases, no per-route
percentile or statistically representative tail estimate.

During the run the operator process samples aggregate Docker CPU and
memory percentages for API, PostgreSQL and Redis, and counts other
database client sessions excluding the observer. Reported maxima are
sampled observations, not continuous peak measurements or acquisition
latency. No response body, credential, raw SQL or identity enters the
report. The container is resource-limited, nonroot and has no published
ports or external network; resources are cleaned up after rehearsal.

This is a light, anonymous route/transport baseline, not a business
transaction capacity or saturation test. Readiness uses shared
single-flight checks, so it cannot establish database pool saturation.
Representative authenticated read/write workloads, populated fixtures,
pool-wait latency, independent load generator and production-like hardware
remain necessary under #313/#922/#923 before scaling or Beta GO.

### DEP10e — two-container replica and scale-down rehearsal

The disposable full-stack rehearsal temporarily scales its API service to
two independent containers of the same exact image, with the same test
PostgreSQL, Redis and authentication configuration. It validates Compose
project ownership and the internal network, and checks both containers
are healthy, nonroot and have no published ports. No production Compose
configuration is changed.

A separate internal HTTP Caddy listener uses two explicit container IPs,
round-robin balancing and active readiness checks. Its allowlist contains
only GET readiness and equipment catalogue routes. The test-only upstream
response header proves that both containers receive requests. Public
HTTPS is checked separately by the existing edge rehearsal; the
internal test proxy is neither a production TLS configuration nor exposed
to users. It returns 404 for other paths.

The real anonymous equipment catalogue endpoint must return identical
responses across replicas, and 60 requests must succeed before the
61st is rejected with HTTP 429 by the shared Redis limit. No production
rate-limit setting is modified. PostgreSQL client counts must fit the
two-process pool and advisory-lock allowance. The test stops the second
container, verifies readiness via the surviving upstream, restarts it
and verifies distribution again. Finally it scales down to the original
container before running the existing recovery drill.

This is same-version replica recovery and scale-down, not a cross-version
application rollback or a zero-downtime guarantee during failure onset.
The volume is shared only inside this single-host disposable project;
distributed avatar storage/maintenance, authenticated session and write
acceptance, realistic peak connection usage, separate-host failover,
and signed two-release rollback evidence remain open under #921/#922/#923
and #351. The existing two-release rollback procedure remains unchanged.
Production stays single-instance until those gates and owner approval.
