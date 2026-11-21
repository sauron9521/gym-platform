# Staging readiness — private evidence reference inventory

**Read-only inventory, not a release/deployment gate.** This tool checks
only syntactic presence of operator-provided reference IDs. It does NOT
verify the references, check live staging, provision infrastructure,
contact production, or authorize a production deployment. Every report
has `decision: NO_GO` and `deploymentAuthorized: false`.

## Preparing an isolated staging evidence inventory

1. Provision a disposable or isolated staging environment with actual HTTPS
   and separate API/Web origins. Never reuse production credentials or real
   user data. Naming a domain "staging" is not proof of network isolation.
2. Independently collect evidence of PostgreSQL backup **and restore**,
   avatar restore, TLS proxy and cookie/CSRF checks, SMTP delivery,
   Redis outage fail-closed behavior, authenticated browser/real API
   smoke tests, native Android EAS/Maestro device tests, a rollback
   rehearsal, and an actually delivered monitoring alert.
3. Create a private JSON file with the exact keys in the example below.
   Replace sample IDs and URLs with **your real private staging origins
   and evidence reference IDs**. Values are not verified by this tool.
   Never put keys, cookies, passwords, session tokens, backups, dumps,
   device credentials, screenshots with private data, or production
   approvals into this file.
4. Put the file outside the repository, or in the already gitignored
   root `readiness/` directory. Do not add it to a Git commit.
   Use an absolute path. On POSIX set file permissions to `chmod 600`.
5. Run the inventory check (no network calls or deployment occur):

```sh
node scripts/staging-readiness-inventory.mjs /absolute/path/to/private-evidence.json
```

### Example format — fictitious references only

```json
{
  "stagingApiOrigin": "https://staging-api.example.test",
  "stagingWebOrigin": "https://staging-app.example.test",
  "postgresRestoreEvidenceId": "restore-report-example",
  "avatarRestoreEvidenceId": "avatar-restore-example",
  "tlsProxyEvidenceId": "tls-proxy-example",
  "smtpDeliveryEvidenceId": "smtp-delivery-example",
  "redisFailClosedEvidenceId": "redis-outage-example",
  "browserRealApiSmokeEvidenceId": "browser-smoke-example",
  "androidMaestroEvidenceId": "android-device-run-example",
  "rollbackRehearsalEvidenceId": "rollback-run-example",
  "alertDeliveryEvidenceId": "alert-delivery-example"
}
```

The validator only reports missing **field names** (never submitted values).
Its input must be an absolute regular file, not a symlink, with at most
128 KB of data and owner-only readable on POSIX (mode 0600 or stricter), and owned by the current user.
Files are opened with no-follow semantics for the final path component and
read through a checked descriptor. The operator must also control parent
directory access; these checks do not rule out malicious directory substitution.
These checks help avoid accidental
exposure but are **not** a complete secret-handling or operator-identity
security guarantee.

The process returns exit code `0` only for a **syntactically complete
inventory**, `1` for incomplete references, and `2` for unreadable or
unsafe input. **Exit code 0 never means GO.** Never put this command in a
deployment authorization condition or treat it as independent verification.

A genuinely authorized release requires the separately reviewed signed
release chain and private operator controls documented in
[production readiness](production-readiness-review.md) and
[live staging smoke](staging-live-smoke.md). Existing production
readiness tooling and independent manual approvals remain the only
relevant process; this PR does not modify them.
