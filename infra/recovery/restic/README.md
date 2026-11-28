# INF06d — Encrypted media and coordinated recovery rehearsal

This local candidate complements [native PITR](../README.md),
[pgBackRest](../pgbackrest/README.md) and [Redis recovery](../redis/README.md).
It does not replace the existing
[logical backup toolkit](../../../docs/operations/backup-restore-operations.md)
or authorize a live deployment.

## Reproduce

From the repository root on Linux with Docker:

```sh
bash infra/recovery/restic/verify.sh
```

The validation image uses the existing digest-pinned PostgreSQL 17 Alpine
base and restic 0.18.1-r9 from the signed Alpine repository. Transitive
package versions resolve at build time rather than from a frozen snapshot.
This is a test image, not a production database or media service image.

The container runs as the postgres user with no network, published ports,
host data volume or capabilities, a read-only root and bounded tmpfs for
data and a separate repository. A random synthetic password is written
to a private temporary file and is never printed. Only the test script
is mounted read-only. No real application data or credentials are used.

## Acceptance evidence

The fixture uses PostgreSQL and a minimal synthetic profiles table with
avatar keys and expected SHA-256 hashes. The fixture hash field is not a
proposed application schema migration. No concurrent writers are present.

1. Pair a logical database dump with its matching media files under a
   single labelled Restic snapshot.
2. Check the encrypted repository using `restic check --read-data`,
   reject a wrong password, then restore with verification into a fresh
   directory and restore the dump into a separate empty test database.
3. Verify referenced filenames and exact hashes. Require rejection of
   both missing and changed files.
4. Model a deletion occurring after backup by keeping synthetic current
   tombstone evidence outside the snapshot and removing the source
   reference and file. Reapply the tombstone to the restored database.
5. Build a private eligible-file set exclusively from remaining
   verified references. Prove that deleted and unreferenced media are
   excluded, the retained file matches its expected hash, and the
   later source state is unchanged.

The initial complete run passed with Restic 0.18.1 and PostgreSQL 17.12
in 11.55 seconds including the image build. Full-scope tooling CI runs
the isolated rehearsal. The small fixture runtime is not evidence of
production RPO or RTO.

## Recovery and privacy boundaries

A common snapshot label is not an atomic cross-system transaction.
The fixture has no active writers; actual deployments must establish
a quiesced recovery point or another reviewed consistency protocol.
PostgreSQL PITR and independent media snapshots must be reconciled at
the selected recovery point. The logical dump in this test is only a
pairing fixture, not a replacement for pgBackRest or PostgreSQL PITR.

As required by
[S05](../../../docs/product-strategy/s05-security-trust-v1.md) and
[S06](../../../docs/product-strategy/s06-production-reliability-v1.md),
keep restored data private until current deletion and revocation
evidence has been reapplied. The independent tombstone file models the
requirement only: this slice does not implement a production tombstone
ledger, retention policy, deletion workflow or application authorization.
Unreferenced media is excluded from the eligible set, not automatically
deleted from an old backup. Actual backup retention and erasure rules
require the approved privacy and legal policies.

Before live activation, approve independent encrypted off-host storage,
credentials and key recovery, authenticated transport, backup scheduling
and retention, private restore targets, and coordinated data/media
reconciliation. Use the actual schema, storage adapter and application
authorization checks on staging. Verify realistic restore timings,
deletion/revocation non-resurrection and external delivery reconciliation
before admitting traffic. The temporary local repository is neither
durable nor independently recoverable after host loss.

No live services, paid resources, credentials or storage policies were
changed. Production and Beta remain NO_GO.
