# Verified API release and GHCR publication (PR #16)

These are **two manual-only workflows** from the previous API repository,
adapted to the Node 24 / pnpm monorepo. Neither workflow deploys Gym Platform,
runs database migrations or modifies production Compose.

## Prerequisites

1. Merge API changes into protected main. Wait for the full
   `CI` workflow on that exact SHA to complete successfully.
2. Review the production Docker baseline in
   `infra/docker/production/README.md`. Review third-party Action
   versions, image scanners, base-image security and GitHub repository
   permissions before enabling the release process.
3. Never dispatch either workflow from a pull request or feature branch.
   The jobs explicitly require `refs/heads/main`.

## Phase 1: build and attest a release candidate

In GitHub Actions, run **Release candidate images and signed provenance**
manually against `main`. The workflow:

- Requires a completed, successful main-branch **push** CI workflow for the
  exact source SHA. A newer failed run blocks release.
- Resolves a digest-pinned `node:24-trixie-slim` base image; uses the
  **monorepo root** as Docker context and `apps/api/Dockerfile`.
- Builds both non-root `gym-platform-api:runtime-SHA` and
  `gym-platform-api:migrate-SHA` from the _same_ source commit.
- Archives the exact images and produces a SHA-256 manifest containing
  repository, source SHA, base digest, workflow run ID and image config IDs.
- Attests both files with GitHub OIDC/Sigstore and uploads
  `gym-platform-api-release-SHA-RUN_ID` retained for seven days.
- Independently downloads the archive, checks manifest integrity and
  attestation signer/source, reloads the images and checks image IDs and labels.

A green **package** job without the independent **verify** job is insufficient.
No packages are pushed to GHCR by this workflow.

## Phase 2: manual GHCR publication

In GitHub Actions, run **Publish verified release candidate to GHCR** on
`main` and supply the exact successful release run ID and 40-character
source SHA. Explicitly select `PUBLISH_VERIFIED_CANDIDATE` (default is
`NO_PUBLISH`). The job:

- Rejects an incomplete/mismatched release workflow or missing green
  exact-commit main CI.
- Downloads and verifies the original artifact, both GitHub attestations,
  image config digests, revision labels and non-root identity. **No rebuild.**
- Generates independent SPDX SBOMs and Grype vulnerability reports for
  runtime and migration images; critical findings prevent publication.
- Fails closed unless both destination SHA/run tags are absent in GHCR.
- Publishes into `ghcr.io/OWNER/gym-platform` and
  `ghcr.io/OWNER/gym-platform-migrate`; records immutable registry
  **@sha256 digests**, signs OCI provenance and SBOM attestations, then
  independently verifies those signatures.
- Keeps digest-only receipts and security evidence as workflow artifacts.

A GHCR _tag_ is still mutable; use the attested `@sha256` digest for any
future deployment. The GITHUB_TOKEN requires repository Actions permission
to write packages; package visibility/access must be configured separately.

## Safety and rollout status

Production deployment and database migrations are **not implemented** in
either workflow. Configure protected main and limit who can dispatch
privileged workflows. Do not enable operator deployment until staging
rehearsal, backup/restore, rollback and explicit approval exist.

The CI quality job runs offline regression tests for the release manifest,
GHCR promotion, SBOM validation and CI source gate. It never attests or
publishes images. This does **not** substitute for a first manual release
and GHCR dry run with real GitHub attestations/package permissions.
