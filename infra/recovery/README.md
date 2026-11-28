# INF06a — Native PostgreSQL point-in-time recovery rehearsal

The owner approved self-hosted PostgreSQL under the
[INF01 budget decision](../../docs/operations/infrastructure-hosting-decision.md).
This slice verifies a native PostgreSQL 17 physical backup and WAL replay
against synthetic data. It supplements, rather than replaces, the existing
[logical dump and avatar recovery tooling](../../docs/operations/backup-restore-operations.md).
No provisioning, live database connection, real backup or deployment is authorized.

## Run the disposable rehearsal

From the repository root on Linux with Docker:

```sh
bash infra/recovery/verify-pitr.sh
```

The wrapper uses the existing digest-pinned PostgreSQL 17 Alpine image
(17.12 at initial verification), as the postgres user, without networking,
published ports, capabilities, Docker socket or host data volumes. Only
the fixture script is mounted read-only; both databases and the archive
reside on bounded tmpfs. The image's declared data volume is also
overridden by tmpfs. Local Unix-socket authentication is trust only within
this synthetic container; it is not a recommended production HBA policy.
The Docker daemon may fetch the pinned image if it is absent.

The fixture creates two distinct data directories, socket paths and
ports. It performs the following operations:

1. Initialize a synthetic source cluster with WAL archiving enabled and
   insert a known pre-backup row.
2. Take a physical base backup using pg_basebackup with streamed WAL and
   SHA-256 manifest checksums. Verify it using pg_verifybackup.
3. Change a same-length synthetic backup file; require checksum rejection.
   Restore the original file and verify the backup again.
4. Commit a second row, create a named recovery point, then update the
   first row and insert a third row after that point.
5. Force a WAL switch and wait for archive completion, checking both
   the actual WAL file and pg_stat_archiver. Verify the relevant segment
   was absent from the base backup.
6. Stop the source, recover the separate target from the physical backup
   and archived WAL, and promote at the exact named restore point.
   Require log evidence that the expected segment was restored from the
   archive and that replay stopped at the named point.
7. Verify the first two rows exactly and exclude both later changes.
   Perform a new write against the restored database. Stop it, restart
   the original source and verify its later state is intact.

The container exits and its tmpfs data disappear. Full-scope CI runs this
same isolated rehearsal; no actual infrastructure is modified.

## Remaining INF06 work

| Slice  | Candidate scope                            | Acceptance                                                                                                                         |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| INF06a | Native PostgreSQL physical backup and PITR | Local synthetic named-point recovery and checksum rejection                                                                        |
| INF06b | Encrypted off-host database backup         | Evaluate pgBackRest or equivalent; independent repository, WAL durability, retention, failure handling and separate-target restore |
| INF06c | Redis recovery and queue reconciliation    | Classify durable vs disposable state, prove restart behavior and reconciliation                                                    |
| INF06d | Private media and coordinated recovery     | Evaluate encrypted Restic or equivalent, validate consistency with database and privacy tombstones, realistic restore drill        |

These are proposed reviewable increments of INF06, not additional
authorization. Reuse existing recovery and notification contracts;
do not create a second incompatible backup system.

The temporary local archive is not durable, encrypted, independent or
off-host. The simple local copy archive command is a fixture only:
production must tolerate retries, verify complete durable archive writes,
prevent corruption and monitor backlog and failures. A named restore
point demonstrates PostgreSQL PITR mechanics, not arbitrary wall-clock
target selection, recovery from an actual host failure, application
migration compatibility, full dataset recovery or coordinated media state.
The tiny fixture runtime is not a measured production RPO or RTO.

Before activation, review PostgreSQL and Redis configuration, separate
roles and storage, encrypted independently recoverable backups, WAL
archiving policy, retention, key recovery, restore targets, data and
media consistency and operational monitoring. Demonstrate the approved
Beta RPO <= 1 hour and RTO <= 4 hours with realistic data, application
journeys and independent evidence within the approved total monthly
budget. Production and Beta remain NO_GO.
