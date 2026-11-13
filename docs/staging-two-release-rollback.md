# Signed two-release staging upgrade and runtime-only rollback

This is a **manual** GitHub Actions rehearsal for **two distinct releases**
of Gym Platform API. It creates all data and Docker resources on a disposable
GitHub-hosted runner, verifies four published signed GHCR image digests, then
tests whether the _previous runtime_ can still serve requests **after the
target release's forward Prisma migrations**. It never touches production.

## Preparation: two published signed releases required

First complete the separate manual release-candidate and
`publish-ghcr.yml` processes for **each release** using source commits on
the Gym Platform `main` lineage. They must have distinct source SHAs,
runtime and migration image digests.

In GitHub Actions select **Manual two-release staging upgrade and runtime
rollback**, choose `main` and enter:

| Input                     | Meaning                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `previous_runtime_digest` | Earlier `ghcr.io/sauron9521/gym-platform@sha256:...`         |
| `previous_migrate_digest` | Earlier `ghcr.io/sauron9521/gym-platform-migrate@sha256:...` |
| `previous_source_sha`     | Full SHA of the earlier source commit                        |
| `previous_publish_sha`    | Full SHA of the earlier GHCR publish signer                  |
| `target_runtime_digest`   | Later runtime immutable digest                               |
| `target_migrate_digest`   | Later migration immutable digest                             |
| `target_source_sha`       | Full SHA of the later source commit                          |
| `target_publish_sha`      | Full SHA of the later publisher signer                       |
| `confirm_upgrade`         | Explicitly select `REHEARSE_SIGNED_UPGRADE_ROLLBACK`         |

Use **only new Gym Platform GHCR packages** and digest receipts from
successful manual publications. Do not reuse standalone
`gym-api-nestjs` image digests. If two Gym Platform releases have not
been published, this workflow **cannot be considered tested**; do not invent
digest values or use mutable tags. The previous source must be an ancestor
of the target; both OCI SLSA v1 provenance and SPDX attestations are
verified against the corresponding publisher commit and source branch.
Both images are pulled by digest, not rebuilt, and source labels and
non-root image identities are checked.

## Seven ordered compatibility gates

1. Apply the **previous migration image** to isolated PostgreSQL 17.
2. Run the **previous runtime** with Redis 7 and create one synthetic
   account. Test registration, credential login, JWT, refresh token and
   decimal profile data. No real email is sent.
3. Create and SHA-256 verify a **private test-database-only** `pg_dump`.
4. Apply the **target migration image** to the populated database,
   without stopping the previous runtime.
5. Verify that the **previous runtime still serves authentication and
   existing synthetic data on the target schema**.
6. Replace the API container with the **target signed runtime** and
   verify protected profile, refresh token continuity and health.
7. Roll back **only the runtime** to the previous signed digest, with
   **no reverse Prisma migration and no database restore**. Verify that
   the old runtime still authenticates and preserved profile data.

The state machine in `scripts/staging-upgrade-rollback.mjs` enforces this
exact order. Any skipped, repeated, incomplete or out-of-order stage
fails. The Docker helper `scripts/staging-upgrade-run.sh` requires
GitHub Actions, a namespaced disposable runner API, ephemeral JWT key,
isolated network, DB and Redis; it does not contain DB reset or
`pg_restore` code. Previous and target images must remain immutable
`sha256` digests.

## Runtime safety and evidence

The workflow starts a temporary Docker bridge, PostgreSQL 17, Redis 7,
avatar volume and a loopback-only API on `127.0.0.1:31848`.
Runtime hardening includes a read-only root filesystem, tmpfs, all
capabilities dropped, no privilege escalation, non-root user and
resource limits. Migration images operate only on the disposable
PostgreSQL URL. Docker packages/attestations are **read-only**.

The private runner state includes a synthetic refresh token and a
test-only PostgreSQL dump. Neither is uploaded. A credential-free JSON
receipt is retained at `staging/upgrade-evidence.json` for 30 days.
The cleanup steps run even on failure: delete token state, temporary
signing key, DB backup, container/volume/network. Review the **entire
workflow conclusion**, not just an evidence file, before accepting a run.

This PR adds offline tests to ordinary CI. Offline tests do **not**
publish signed images and cannot prove an actual cross-version migration
until a human manually triggers the new workflow after publishing
two different real Gym Platform releases.

## Not a production authorization

Even a successful two-release rehearsal proves only compatibility for
these **two signed digests** and synthetic data in a short-lived
environment. It does not prove production-scale backup restoration,
real SMTP, external HTTPS/CSRF/cookie proxies, traffic scaling, alert
delivery, all trainer/workout workflows or contractual RPO/RTO.

Remain **production NO-GO** until independent release/staging evidence
review, real backup/restore and human operator approval. Never
reverse/drop the production schema simply to restore the old runtime.
If migrations are not backward compatible, abort cutover and redesign
the expand/contract deployment sequence.
