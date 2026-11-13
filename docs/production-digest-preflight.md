# Production digest preflight — immutable GHCR Compose policy

This is a **review-only safety layer**, not a deployment script. The
monorepo contains opt-in single-host production packaging at
`infra/docker/compose.prod.yaml`. Its ordinary images are **local
builds**, so operators must **not** treat that baseline alone as an
authorized production release.

PR #23 adds `infra/docker/compose.digest.prod.yaml` to override both
image references with trusted immutable GHCR digests and explicitly
remove both build definitions. The Node validator
`scripts/production-digest-guard.mjs` refuses unsafe image identity,
missing revision labels, privileged or unbounded Compose settings,
unexpected service definitions or a mismatched running image.

## What the guard can check

- Only full, lowercase digest refs from
  `ghcr.io/sauron9521/gym-platform@sha256:...` and
  `ghcr.io/sauron9521/gym-platform-migrate@sha256:...` are accepted.
- Two distinct full Git SHAs bind source revision and attestation
  publisher identity. The currently deployed image must match the
  explicitly approved prior digest, or `none` on first deployment.
- In the **merged Compose configuration**, there are exactly `api`
  and `migrate` services with **no build definitions**.
- API remains non-writable, non-privileged, bounded to loopback and
  bounded CPU/RAM/PIDs, and keeps a persistent avatar volume.
  Migration remains **opt-in** via the `ops` profile, read-only,
  without published ports or additional privileges.
- Pulled Docker image objects must report Linux/amd64,
  `Config.User=node`, matching OCI source revision labels,
  valid image config IDs and the exact expected `RepoDigests`.

The Compose configuration contains environment variables and can contain
secrets. The guard reads merged Compose JSON from **stdin**, never
prints the input configuration or any credentials, and emits only a
short success/failure message.

## Offline example (no production services)

The CI verification creates **synthetic test values only** and runs:

```sh
node --test scripts/production-digest-guard.test.mjs

docker compose --env-file infra/docker/.env.example \
  -f infra/docker/compose.prod.yaml \
  -f infra/docker/compose.digest.prod.yaml \
  --profile ops config --format json |
  node scripts/production-digest-guard.mjs compose
```

The pipeline requires non-sensitive, synthetic values for
`DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`, `APP_URL`,
`CORS_ORIGINS`, `SMTP_URL`, `MAIL_FROM`,
`DEPLOY_RUNTIME_IMAGE` and `DEPLOY_MIGRATE_IMAGE`. They are set in
the repository CI job. The command only resolves and validates YAML;
it **does not** build/pull containers, access databases, start a
runtime, run Prisma migrations or modify server configuration.

The `refs` mode validates the provided immutable references;
`images` can inspect **already pulled** Docker image metadata;
`current` compares the known running image digest, supplied by a
trusted operator. These are independent checks, not an authorization.
The guard does not fetch GitHub evidence or verify an attestation by
itself: that remains the job of the manual signed GHCR and
`production-readiness.yml` workflows.

## What is intentionally _not_ in PR #23

This PR **does not include a production apply/rollback script** or
connect the guard to live Docker operations. No GitHub Actions workflow
has permissions to push images, SSH into production, run SQL migrations
or change routing as a consequence of merging this PR.

A later, separate operator-reviewed PR may add manual production
`preflight`/`apply`/`rollback` commands. Those commands will
require proof of a real signed publication, successful two-release
staging, private off-host restored PostgreSQL **and** avatar backups,
exact currently running digest, safety checks on reverse proxy/TLS,
monitoring alerts and distinct explicit human approvals.

**Production remains NO-GO.** Until the above evidence exists and the
owner approves traffic cutover, the old standalone
`gym-api-nestjs` API is still the operational source of truth.
