# Signed GHCR ephemeral staging rehearsal — Gym Platform

This workflow is **manual and opt-in**. It never runs on PRs, pushes,
merges or schedules. It tests previously published **immutable** runtime
and Prisma migration images on disposable GitHub-hosted infrastructure,
not on a remote server. No production credentials, SSH or databases.

## Prerequisites

1. Merge a green source commit into protected `main`.
2. Manually run `release-artifacts.yml` and verify its independent
   artifact validation job.
3. Manually run `publish-ghcr.yml` against the candidate run ID and
   exact source SHA. Choose `PUBLISH_VERIFIED_CANDIDATE` explicitly.
4. Copy **both complete digest references** and the source and publisher
   full Git SHAs from that successful publication's receipt.

New package namespaces are:

- Runtime: `ghcr.io/sauron9521/gym-platform@sha256:<64-hex-digest>`
- Migrations: `ghcr.io/sauron9521/gym-platform-migrate@sha256:<64-hex-digest>`

These are placeholders, not usable digest values. Do not use mutable
tags, old standalone-repo images, or synthetic/guessed hashes.

`source_sha` means the signed application source revision;
`publish_sha` is the commit that published and attested OCI objects.
These are not interchangeable.

## Manual invocation

In GitHub Actions select **Manual staging smoke of verified GHCR images**
and **Run workflow** on `main`. Supply:

| Input             | Meaning                                   |
| ----------------- | ----------------------------------------- |
| `runtime_digest`  | Exact runtime digest ref from publisher   |
| `migrate_digest`  | Exact migration digest ref from publisher |
| `source_sha`      | Full signing source Git SHA               |
| `publish_sha`     | Full publisher signer Git SHA             |
| `confirm_staging` | Select `RUN_EPHEMERAL_STAGING`            |

The job requires read access to GHCR packages and GitHub attestations,
but no registry write, production secrets, OIDC signing or SSH. Rejects
invalid namespace, non-main ref, missing confirmation and mutable refs.

## What is validated

1. Independently verify SLSA provenance and SPDX inventory on _both_
   digests, bound to this repository's manual GHCR publisher and SHA.
2. Pull by digest without rebuilding. Verify image ID, source revision
   label, Linux amd64 and non-root runtime identity.
3. Start isolated PostgreSQL 17, Redis 7 and temporary avatar volume.
   DB and Redis expose no host ports. Only API binds the runner's
   loopback `127.0.0.1:31848`.
4. Run the exact signed Prisma migration image against an empty
   disposable database; start the runtime with read-only root,
   tmpfs, dropped capabilities, capped resources and random JWT key.
5. Require Docker healthy state, then HTTP 200 and JSON status `ok`
   for `/health/live` and `/health/ready`.
6. Test real synthetic HTTP flows: anonymous denial, registration,
   credentials login, JWT user profile, fractional weight, refresh-token
   rotation and forbidden credential leakage. SMTP is deliberately
   unavailable and should not cause unsafe API failures.
7. Re-run forward Prisma migrations on the populated test database,
   preserve synthetic state, gracefully restart the **same** signed
   runtime and re-verify refresh-token/session/profile preservation.
8. Record **non-sensitive** evidence only; remove local state containing
   refresh tokens and delete all temporary Docker objects even on error.

Evidence receipts are written to `staging/evidence.json` and
`staging/functional-evidence.json`. The temporary runner-only
`staging/functional-state.json` contains a refresh token, is ignored
by Git and is deleted before evidence upload. No email, password, token,
DB backup, raw user data or Docker environments belong in artifacts.

## Limitations and troubleshooting

A successful manual run proves these two **signed digests** work on
disposable runner staging with forward migration replay and a same-image
restart. It is **not** a two-release upgrade, backward-compatibility
test, production database rehearsal, deployed staging host, live email
delivery, TLS/CORS test, or alert-delivery validation.

- Attestation errors: verify publisher SHA, signer workflow, package
  access and image digest receipts.
- Health failure: check sanitized API, DB and Redis steps.
- Registration and auth failures: synthetic SMTP is intentionally
  inaccessible; do not disable security to pass staging.
- Missing artifacts: an early identity failure can prevent receipts;
  GitHub Actions job conclusion remains authoritative.

**Production NO-GO** until the separate [signed two-release rollback drill](staging-two-release-rollback.md)
has actually succeeded using two real Gym Platform published releases, and
independent release-evidence review, operator backups/restoration, security
review and explicit operational approval are completed.
The old API stays operational source of truth until authorized cutover.
