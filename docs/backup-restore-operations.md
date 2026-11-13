# API backup, restore and backup-health monitoring

This is an **opt-in operator toolkit**, not a backup service automatically
installed by the monorepo. Merging this PR does not run a backup against
production, start a timer, perform a restore, configure alert delivery or
grant Docker access to the API process.

It adapts the standalone Gym API tools to the production Compose
\`infra/docker/compose.prod.yaml\`. The Compose project name is
\`gym-platform-api\`, so its default avatar volume is
\`gym-platform-api_avatars\`. **Always inspect the actual volume name** if
\`COMPOSE_PROJECT_NAME\` was changed. Local development volumes are
different from production volumes.

## What is included

- \`scripts/backup-production.sh\`: PostgreSQL custom-format dump and a
  read-only tar archive of the avatar Docker volume, with SHA-256 checksums
  and a non-atomic-consistency manifest.
- \`scripts/verify-backup-freshness.sh\`: checks the newest completed backup
  against age, hashes, readable PostgreSQL archive and readable avatar tar.
- \`scripts/restore-drill.sh\`: verifies a backup and restores **only** into
  a previously provisioned, empty database named \`*_restore_test\`, after
  explicit confirmation. It never creates/drops/truncates a database.
- \`scripts/monitoring-backup-health.mjs\`: optional backup-health collector
  using the safe atomic node_exporter textfile writer. The established
  metrics \`gym_api_backup_verified\` and
  \`gym_api_backup_last_check_timestamp_seconds\` keep their existing names
  for dashboard and alert compatibility.
- \`ops/backup/\`: example environment files and manually installed
  systemd oneshot services + timers.
- \`ops/monitoring/backup-health.*.yml\`: optional Prometheus alerts and
  offline promtool test cases for failed, missing and stale verification.

## Prerequisites and storage security

Use an authorized Linux operator host with PostgreSQL 17 or newer client
utilities (\`pg_dump\`, \`pg_restore\`, \`psql\`), Docker, GNU coreutils, tar,
Node 24, systemd and a restricted encrypted backup directory. The private
backup directory must be owned by the operator, not writable by untrusted
processes. Keep an encrypted, independently verified **off-host** backup
and a separately managed retention policy. An on-host archive is not
disaster recovery.

A database dump and avatar tar are **not one atomic snapshot**. For a
coordinated recovery point, disable avatar writes or place the service in
maintenance mode during snapshot creation. Test restore timings against
realistic data to establish RPO/RTO.

## Manual backup and verification

On the trusted host, clone the monorepo to \`/opt/gym-platform\` (or edit the
systemd templates to match the actual checkout path). Use a secret manager,
not Git, CLI history, tickets or unprotected systemd override files, to
supply credentials.

1. Create \`/srv/private/gym-backups\` with permission \`0700\`.
2. Copy \`ops/backup/backup.env.example\` to
   \`/etc/gym-platform/backup.env\` as root with mode \`0600\`.
   Set \`BACKUP_DATABASE_URL\` to a **libpq-compatible** PostgreSQL connection
   string, excluding Prisma-only query parameters such as \`?schema=public\`.
   Set \`AVATAR_VOLUME\` to the verified production volume. The legacy
   \`DATABASE_URL\` fallback is supported only for compatibility.
3. From the repository root, in an authorized shell with the variables
   securely provided, run:

   \`\`\`sh
   bash scripts/backup-production.sh /srv/private/gym-backups
   BACKUP_MAX_AGE_HOURS=26 bash scripts/verify-backup-freshness.sh /srv/private/gym-backups
   \`\`\`

4. Verify that both archives and SHA256SUMS exist, confirm the stored
   manifest shows a non-atomic snapshot, and replicate backup artifacts
   to protected off-site storage before considering it recoverable.
5. **Only after a successful manual test**, inspect and install
   \`ops/backup/gym-platform-api-backup.service\` and
   \`ops/backup/gym-platform-api-backup.timer\` into
   \`/etc/systemd/system/\`. As root, review their Docker access and
   paths before explicitly running \`systemctl daemon-reload\` and
   \`systemctl enable --now gym-platform-api-backup.timer\`.
   The timer runs at 03:30 host-local time with bounded jitter.

Backup uses Docker access as root; the API container and ordinary
monitoring service must never receive its credentials or Docker socket.
This PR neither deletes old backups nor implements automated retention.

## Guarded restore drill — not for production

Provision a separate, **empty** test database whose connected name ends
with \`_restore_test\`. Run with a dedicated disposable target and explicit
acknowledgement:

\`\`\`sh
export RESTORE_DATABASE_URL='postgresql://restorer@isolated-host/gym_restore_test'
export RESTORE_DRILL_CONFIRM='I_ACKNOWLEDGE_ISOLATED_RESTORE'
sh scripts/restore-drill.sh /srv/private/gym-backups/gym-platform-api-<backup-id>
\`\`\`

The script checks hashes and archives **before connecting**, refuses an
identical \`DATABASE_URL\`, verifies the actual connected database name and
that no user tables exist, then performs a single-transaction PostgreSQL
restore. It checks that \`public.users\` and
\`public._prisma_migrations\` exist afterwards. It does **not** restore
avatars. In staging, extract the avatar archive into a separately
provisioned *disposable* volume after manual review.

## Monitoring (optional; never enabled by CI)

Install \`ops/backup/backup-health.env.example\` as
\`/etc/gym-platform/backup-health.env\` with mode \`0640\`. Set the absolute
backup root and existing node_exporter textfile directory. Review and
install \`gym-platform-api-backup-health.service\` and its fifteen-minute
timer. It needs **read-only backup access**, no DB credentials and no
Docker socket. Confirm node_exporter scrape and
\`node_textfile_scrape_error = 0\` before enabling rules.

Prometheus alerts are defined in
\`ops/monitoring/backup-health.rules.yml\`:

- \`GymApiBackupVerificationFailed\`: newest backup failed validation.
- \`GymApiBackupHealthSnapshotMissing\`: collector metric absent.
- \`GymApiBackupHealthSnapshotStale\`: collector not updating.

These historical alert identifiers are preserved to avoid breaking
existing monitoring consumers. Provision, test and route Alertmanager
notifications separately; a green promtool test does **not** prove that a
human received a page.

## CI verification and limitations

CI performs shell syntax checks, mock backup failure tests, restore safety
tests, collector and atomic textfile tests, systemd template verification
and Prometheus alert rule tests **offline**. The API PostgreSQL e2e job
also creates a disposable PostgreSQL 17 custom dump of its dedicated test
database, restores it into a fresh \`gym_restore_test\` database, and
extracts sample avatars into a temporary Docker volume. Those resources
are destroyed afterwards. This is **not** a production backup.

Further operational work: general HTTP/Redis monitoring, SLO rules, secure
forwarding, alert delivery receipts, off-host replication and production
rollback rehearsal. The standalone repository remains operational source
of truth until the migration is signed off.
