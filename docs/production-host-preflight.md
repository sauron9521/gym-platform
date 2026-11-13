# Operator-only production host preflight (read-only)

**Status: production NO-GO.** This is a security and readiness
diagnostic, not an authorization to migrate traffic or deploy. PR #24
adds the local-only `scripts/production-host-preflight.sh preflight`
command. It has exactly one mode: `preflight`. There is no
`apply`, `rollback` or remote GitHub deployment action.

## Preconditions — controlled by an authorized operator

- Linux operator host with Node 24, Docker Engine + Compose,
  GitHub CLI with **attestation read access**, PostgreSQL
  `pg_restore` client, `sha256sum` and `tar`.
- A real manually published signed Gym Platform runtime and
  migration image at **exact immutable GHCR digests**. The
  **two image objects must already exist in the local Docker cache**.
  This preflight **does not pull, build or start images**.
- The successful independent read-only
  [release evidence review](production-readiness-review.md) exported
  as `release-evidence.json` to a private host directory.
  **Independently verify its GitHub Actions run ID and origin before
  copying**: a JSON file can be edited, and local structural checks
  cannot cryptographically prove who authored it.
- A private PostgreSQL custom-format archive
  `postgres.dump`, avatar archive `avatars.tar.gz` and
  `SHA256SUMS` manifest from the *same backup directory*.
  The manifest must name those two files only. This is an
  on-host **format and checksum** check, not an off-host restore proof.
- A private production environment file kept outside the checkout,
  readable only by trusted operators, and matching the target database,
  reverse-proxy and email configuration.
- An explicit expectation of the currently deployed monorepo
  Compose image digest, or `none` for an **actual first deployment**
  without an existing container in that Compose project.

Do not use demo digest strings or placeholder release receipts with
a real production host. No secrets, JWTs, mail passwords, DB URLs,
backup archives or approvals belong in Git or GitHub artifacts.

## Manual invocation

From the monorepo checkout on an authorized **operator host**,
export the following variables through a private secret-management
session. All digest and SHA values below must come from real verified
publication receipts; examples shown are **names**, not sample
credentials:

| Environment variable | Required source |
| --- | --- |
| `DEPLOY_ENV_FILE` | Absolute private production env file |
| `DEPLOY_RUNTIME_IMAGE` | Immutable runtime `ghcr.io/sauron9521/gym-platform@sha256:...` |
| `DEPLOY_MIGRATE_IMAGE` | Immutable migration `ghcr.io/sauron9521/gym-platform-migrate@sha256:...` |
| `SOURCE_SHA` | Source commit identified in signed release |
| `PUBLISH_SHA` | Exact GHCR publisher signing commit |
| `EXPECTED_CURRENT_IMAGE` | Currently deployed signed digest, or `none` for first deploy |
| `PRODUCTION_RELEASE_REPORT` | Absolute private path to real reviewed `release-evidence.json` |
| `BACKUP_DIR` | Absolute private directory containing both archives and checksums |

Once those values are configured:

~~~sh
bash scripts/production-host-preflight.sh preflight
~~~

The command refuses to run inside GitHub Actions, does not print the
environment or the merged Compose JSON, and stops on its first error.

## Exact checks performed

1. The release receipt is a **recent (no more than seven days)**,
   explicitly `NO-GO`, matching all selected source/publisher
   identities and runtime/migration digests. All nine exact main CI
   job labels and seven staging phases must be present. This is
   **structural validation only**; verify the receipt's real
   GitHub Actions provenance independently.
2. The backup manifest lists exactly `postgres.dump` and
   `avatars.tar.gz` with valid SHA-256 hashes. The directory and
   each file must be real non-symlink objects without group/world
   write permissions. Actual SHA checks are then run; PostgreSQL
   dump metadata and tar listing must be readable.
3. All four OCI attestations (SLSA provenance and SPDX SBOM for
   each of the two immutable digests) are checked against the exact
   trusted manual Gym Platform `publish-ghcr.yml` signer on
   `main` and `PUBLISH_SHA`.
4. Cached Docker images must have matching immutable RepoDigests,
   source OCI revision labels, Linux/amd64 and a non-root user.
5. The combined production Compose config must have no local builds,
   loopback-only API binding, resource limits, a persistent avatar
   volume and an opt-in, non-exposed one-shot migration service.
6. The **actual existing API container** in this Compose project, if
   any, must use `EXPECTED_CURRENT_IMAGE`, protecting against
   replacing an unknown local build or a drifted runtime.

**Important:** The local manifest and container checks are not a
substitute for actually restoring the database **and avatar files** on
a separate isolated host, proving external TLS/cookie security,
documenting a staffed maintenance window, or testing alert delivery.
They also cannot detect an API currently served from a **different
Compose project**. Confirm all existing traffic routing independently.

## Output and failure policy

A successful command ends with:

> Preflight checks passed. PRODUCTION NO-GO: no deploy, migration or rollback ran.

If any input is wrong, a command fails with a generic message or a
read-only tool error. **Do not paste raw logs or private env values in
GitHub issues**. Perform troubleshooting from a trusted terminal.

There is no state mutation beyond normal shell/process execution:
no `docker pull`, `docker run`, `docker compose up`,
`docker build`, database restore, schema migration or rollback.

The required real operational evidence still includes an **off-site**
backup restore, real session/web proxy/auth and email checks, alert
delivery, operator identity and private approval. Only after all of
those have been reviewed may a *separate* explicitly authorized
deployment procedure be considered. The standalone API remains
operational source of truth until an approved cutover.
