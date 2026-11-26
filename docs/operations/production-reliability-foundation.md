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
capacity. Live pool gauges, slow-query instrumentation and thresholds remain
follow-up evidence (#316); no speculative indexes or PgBouncer.

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
dispatcher and worker leases stay in #568/#569.

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
