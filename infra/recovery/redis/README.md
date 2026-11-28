# INF06c — Redis security-state recovery rehearsal

This slice complements [INF06a](../README.md) and
[INF06b](../pgbackrest/README.md). It is a local test, not a production
Redis configuration or a new queue dependency.

## Ownership and recovery policy

Current API Redis usage is centralized in
`DistributedThrottlerStorage`. It stores expiring opaque rate-limit
counters and timed blocks, including account recovery, verification
resend and admin MFA attempts. Configured Redis failures are rejected
rather than falling back to per-process counters.

| State                                              | Authority           | Recovery                                                                  |
| -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Rate-limit counters and blocks                     | Redis, with expiry  | Preserve active windows across ordinary restart; never silently evict     |
| Sessions, account and workout state                | PostgreSQL          | Recover PostgreSQL and apply existing authorization policies              |
| Notification Inbox, outbox, leases and retry state | PostgreSQL          | Reconcile durable records before resuming dispatch                        |
| Future queue transport or cache                    | Not introduced here | Rebuild only from permitted authoritative state, with durable idempotency |

The [notification architecture](../../../docs/architecture/notifications.md)
retains PostgreSQL outbox and leases for MVP. Do not adopt BullMQ or
a new Redis instance for queues in this slice. If later approved,
separate security and queue instances, credentials, persistence and
resource limits. Never use a Redis snapshot to replace PostgreSQL
business records or replay external side effects automatically.

## Local evidence

Run with Docker from the repository root:

```sh
bash infra/recovery/redis/verify.sh
```

The existing digest-pinned Redis 8 image runs as the redis user, with
no network, published ports, host data volumes, capabilities or Docker
socket. Only two read-only fixture files are mounted. Data is bounded
tmpfs, the root filesystem is read-only and access is through a private
Unix socket. This is not an ACL/TLS test or a host deployment.

The candidate uses multipart AOF with RDB preamble, every-second fsync,
strict truncated-AOF loading and noeviction. Automatic standalone RDB
snapshots are disabled in this fixture; an explicit SAVE creates the
older comparison snapshot. The small memory limit is not production sizing.

The rehearsal:

- Saves a synthetic counter to RDB, then updates it and adds a timed block
  in AOF. Uses WAITAOF on the writing connection to require local fsync.
- Terminates only the fixture Redis child process using SIGKILL.
- Checks the RDB and complete multipart AOF manifest without repair.
- Starts Redis again against the same disposable directory. Verifies
  AOF takes precedence over the older RDB, the acknowledged write
  survives, active TTLs decrease instead of resetting, and the short
  expired key is absent.
- Forces a tiny synthetic memory ceiling and requires an OOM write
  refusal while the original counter and block remain intact. Restores
  the fixture ceiling and verifies a subsequent write succeeds.

The first local run passed on Redis 8.10.3 in 3.69 seconds.
Full-scope tooling CI runs the same rehearsal.

## Recovery boundaries

The test proves process-crash recovery with explicit local fsync
acknowledgement, not power-loss durability, disk failure, replication
or an application-level queue reconciliation. Every-second fsync can
lose recent unacknowledged writes; tmpfs does not survive host failure.
Redis is not included in the PostgreSQL physical backup or WAL chain.

For actual staging, review supported Redis versions, private network
and least-privilege ACL, authenticated connections, memory sizing,
persistent storage, AOF integrity, disk headroom and failure alerts.
Do not automatically repair or truncate an unknown AOF. Keep the whole
multipart AOF directory and manifest together when taking a verified
copy; follow the existing [Redis upgrade procedure](../../../docs/infra/redis-8-upgrade.md)
for version changes. Review retention and protect backups containing
security metadata.

A healthy PING does not prove preserved counters: an empty or stale
store can return PONG. If state continuity cannot be established,
keep affected protected traffic isolated and require operator review
of the maximum active policy windows and an approved recovery plan
before reopening it. This is an operational gate, not a newly
implemented state-loss detector. Do not restore expired blocks as
fresh blocks or reset live counters to bypass rate limits.

After a PostgreSQL recovery, keep notification dispatch disabled until
outbox leases, retry state, recipient permissions, privacy tombstones,
and any ambiguous external deliveries have been reviewed. A delivery
that happened after the recovered database point may not appear in the
restored state; do not blindly replay it. Verify real application
readiness and protected journeys on isolated staging before enabling
traffic or workers. No Redis or PostgreSQL production state is changed.
Production and Beta remain NO_GO.
