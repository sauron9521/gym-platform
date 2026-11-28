# INF06b — Encrypted pgBackRest repository rehearsal

This is a local candidate validation, not an activated backup service.
It extends the [native PITR rehearsal](../README.md) and retains the
existing [logical backup toolkit](../../../docs/operations/backup-restore-operations.md).

## Reproduce

From the repository root with Docker on Linux:

```sh
bash infra/recovery/pgbackrest/verify.sh
```

The build uses the existing pinned PostgreSQL 17 Alpine image and
pgBackRest 2.58.0-r0 from the signed Alpine 3.24 repository. Transitive
distribution packages are resolved at build time, not a frozen package
snapshot. Alpine also installs its PostgreSQL 18 package as a dependency;
the fixture explicitly checks that pg_ctl and psql resolve to PostgreSQL
17 from the base image and the repository reports PostgreSQL 17.
This image is a test candidate only, not a production database image.

The run uses a nonroot postgres user, no network, no host database mounts,
no capabilities, a read-only root and bounded separate tmpfs locations
for database data and the repository. It generates a random synthetic
repository passphrase in a private temporary configuration, never
prints that passphrase or supplies it as a command-line argument.
Only the fixture script is mounted read-only. Local socket trust is
confined to the disposable container.

## Evidence

- Initialize the synthetic source and create an encrypted stanza.
- Run pgBackRest check and a full backup with AES-256-CBC repository
  encryption, then assert that repository metadata reports healthy
  status and a full backup.
- Override the cipher passphrase with a wrong synthetic value and
  require metadata loading to fail; verify the correct passphrase
  still opens the same repository.
- Insert a second row, create a named restore point, make later changes,
  force a WAL switch and wait for the archiver to finish.
- Retrieve the exact archived WAL segment using pgBackRest archive-get
  and verify its size. Restore into a fresh data directory with
  pgBackRest, replay to the named point and promote.
- Require PostgreSQL log evidence of the exact archived segment and
  recovery point, verify exact restored values, exclude later changes,
  perform a new write and prove the original source remains intact.

The final local run reported PostgreSQL 17.12, pgBackRest 2.58.0,
a 22.4 MB synthetic database and a 2.9 MB repository backup, and
completed in 11.66 seconds including cached image build. These small
fixture sizes and timings are not production backup estimates or RPO/RTO.
Full-scope tooling CI runs this rehearsal.

## Production decision still required

The separate tmpfs repository is not off-host, durable, immutable or
independent of the container. No actual cloud backup endpoint, remote
TLS, storage account, retention expiration, outage recovery or key
escrow was tested. The retention settings (two full backups and their
associated archive) are fixture parameters, not an approved policy.

Before enabling production pgBackRest, approve an independent encrypted
repository provider within the combined EUR 50 monthly budget, a
version-compatible production package/image, separate backup credentials
and least-privilege access, authenticated TLS transport, durable WAL
archiving with retries, repository integrity/retention, backup monitoring,
and key recovery outside the failed host. Test restore on a separate
host using only the independent repository and recovered credentials;
measure RPO/RTO with realistic data and verify application and media
consistency including privacy tombstones. Do not replace the existing
backup system until equivalent or stronger recovery is demonstrated.

No live credentials, storage accounts, services, timers, DNS or paid
resources are created. Production and Beta remain NO_GO.
