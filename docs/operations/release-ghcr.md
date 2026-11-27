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

## DEP08 — separate full-stack pilot release

The API-only workflows and v1 receipts above remain supported and unchanged.
The new **Full-stack pilot release candidate** workflow is manually dispatched
on protected main, requires green CI for the exact commit, and builds six
linux/amd64 images using a pinned Node base: runtime, migrate, Landing,
Athlete Web, Trainer Web and Admin. All have source, component and profile
labels. The archive and strict six-component manifest are attested, then
independently re-downloaded, verified and loaded. The manifest includes the
archive SHA-256 and byte length, image config IDs, source SHA/run, platform,
base digest and fixed build profile `full-stack-pilot-noindex`.

Only after a successful candidate run may an authorized operator manually
request **Publish verified full-stack pilot to GHCR** with the source SHA,
release run ID and `PUBLISH_VERIFIED_FULL_STACK_PILOT`. It verifies both
source attestations and exact image IDs without rebuilding. All six SPDX
inventories and Grype scans must pass before any registry push; critical
findings or scanner failure block publication. Separate package names
`ghcr.io/OWNER/REPO-full-stack-COMPONENT` prevent legacy receipt confusion.
Tags are checked for absence; published images are pulled back and checked
against the source manifest. All six registry digests receive provenance
and SPDX attestations, then all twelve attestations are verified. A signed
receipt binds the source manifest hash, publisher SHA/run and six exact
registry digest references to their original config IDs.

Only the complete signed receipt plus original signed manifest from a
successful publisher run is eligible for later staging verification. Partial
pushes are not atomic and are not a valid release; investigate and create a
new candidate run rather than overwriting existing tags. A receipt's JSON
schema alone is not cryptographic evidence: verify the source and publication
attestations, exact successful runs, registry digests and loaded config IDs.
Use digest references only, never mutable tags. The legacy staging and
production preflight intentionally do not accept this new pilot receipt.

The Landing image still disables indexing and uses the pilot build inputs;
Web/Trainer/Admin use the fixed internal API alias. No production promotion
or environment-specific rebuild is authorized. DEP09 must implement/verify
full-stack staging consumption, real HTTPS, SMTP and critical journeys using
these exact signed artifacts. Production readiness remains NO_GO. Offline
regressions exercise tamper and identity rejection; real GitHub signing,
registry permissions and scanner results require separately authorized manual
workflow runs. Neither workflow deploys or migrates a database.

## DEP09 — signed full-stack staging rehearsal

After the two manual release workflows have succeeded, an operator can run
**Manual signed full-stack staging rehearsal** on main, with the source SHA,
release run ID, publisher SHA/run ID and explicit
`RUN_SIGNED_FULL_STACK_REHEARSAL` confirmation. The runner checks the exact
successful builder and publisher runs, source CI, original manifest and signed
receipt, all twelve OCI attestations and all six pulled image IDs. It rejects
missing or substituted components before creating a database or containers.
The digest-only overlay removes all application build definitions; no rebuild
or deployment occurs. The API-only staging workflow is unchanged.

A disposable network, fresh PostgreSQL/Redis, synthetic secrets and one-shot
migration are reused from DEP06. Five synthetic hostnames terminate HTTPS at
an isolated Caddy local CA, with certificate verification by a dedicated client.
The rehearsal checks public pages, actual API rewrites, anonymous session
rejection, internal metrics denial, and readiness failure/recovery on Redis
stop/restart. It publishes no ports and deletes only its own resources.
Local source-build rehearsal in full CI exercises the same edge checks;
manual signed rehearsal requires real signed GHCR receipts.

This is not external staging: no public DNS, certificate issuance, real SMTP,
mobile device, privileged MFA, or full authenticated trainer/athlete journeys
are claimed. A local SMTPS sink is tested as described below. Real isolated staging
requires owner-approved infrastructure, separate database and secrets, SMTP
allowlist and actual HTTPS/native/end-to-end evidence under #351. Beta remains
NO_GO. Do not use a production host or production data for this workflow.

### DEP09b — isolated SMTPS transport

The disposable full-stack rehearsal now creates a pinned Mailpit sink
inside the existing private network. A short-lived test certificate is
generated for the internal hostname; the API receives only its read-only
public trust certificate. No TLS verification bypass, published port,
external SMTP relay, real recipient or persistent mail store is configured.
The runner allows only the exact generated read-only certificate mounts.

The compiled production mail configuration is exercised in the API
container using the actual Nest mail module. A synthetic message must be
captured by Mailpit; non-allowlisted To, CC and BCC recipients must fail
before transmission. The inbox must contain exactly one expected message.
This verifies the transport and allowlist, not account verification links,
password reset, browser authentication or real external provider delivery.
Notification dispatch remains disabled. All mail and certificate resources
are removed with the disposable rehearsal. External staging remains blocked
on infrastructure and actual signed GHCR evidence.
