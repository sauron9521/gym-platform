# Independent production release-evidence review (NO-GO by design)

This is an **opt-in, read-only** check for the **release chain**. It is not
an approval to deploy, not a production preflight and not a substitute
for an operator's backup, security and rollback checks. It **never**
connects to production, starts a container, publishes a package or runs
a database migration.

## Prerequisites

Use two **real** successfully published and attested Gym Platform
releases, not release data from the standalone API repository.

The operator must first have:

1. A successful manually run `publish-ghcr.yml` workflow that published
   the target runtime and Prisma migration digests in GHCR.
2. A successful manually run `staging-upgrade-rollback.yml` workflow
   for the previous and target **signed releases**. The workflow must
   verify all seven compatibility stages, including runtime-only
   rollback while retaining the new forward-migrated database schema.
3. A successful `ci.yml` **push on main** for the exact target source
   Git SHA, completed before its GHCR publication.

These workflows now exist in `gym-platform`. Their presence and the
green **offline** PR CI do **not** mean a real manual release chain has
been executed. **Do not invent publisher/staging run IDs or OCI digests.**

## Running the manual review

Open **GitHub → Actions → Review signed release evidence for production
readiness → Run workflow**, select `main` and enter:

| Input              | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `publisher_run_id` | Successful target GHCR publisher GitHub Actions run ID |
| `staging_run_id`   | Successful signed two-release upgrade/rollback run ID  |
| `confirm_review`   | Explicitly select `REVIEW_RELEASE_EVIDENCE`            |

The review obtains workflow metadata from GitHub, downloads only the
matching `ghcr-digests.json` and
`staging-two-release-<run-id>-<run-attempt>` receipts, and resolves the
source commit's actual GitHub CI workflow run and its individual jobs.
The validator requires **all nine** current monorepo CI jobs to have
successful conclusions, not the four obsolete standalone checks.

The workflow cryptographically checks **both** target OCI digest
attestations: SLSA v1 publisher provenance and SPDX SBOM, matching
`publish-ghcr.yml` on `main` and the exact publisher signer SHA.
The release manifest digest refs must match the staging receipt's
**target** runtime and migration refs. The two version identities and
seven ordered test stages must match, with an explicit assertion that
the test never contacted production or rolled back the database.

## Output and interpretation

A successful workflow produces a _limited_ receipt at
`readiness/output/release-evidence.json` (artifact retention: 30
days), with status fields:

- `releaseEvidence: VERIFIED` — the GitHub release, CI and staging
  proof chain was validated for specific immutable image digests
- `decision: NO-GO` — no production deployment is approved
- `productionReleaseApproval: false` and `deployTriggered: false`

The read-only workflow never emits `GO` and cannot create a production
environment or turn on deployment. If any source SHA, digest, signer,
workflow identity, GitHub job, timestamp or staging stage is invalid,
the job **fails closed** and should not produce a successful receipt.

No passwords, refresh tokens, database dumps, production credentials,
private approvals or host system files belong in GitHub artifacts.
`readiness/` is ignored by Git in this repository.

## Independent operator requirements (still outstanding)

Before any decision to migrate traffic from the original standalone
API to Gym Platform, a human operator must privately verify:

- Real PostgreSQL and avatar backups **off-host**, with completed
  isolated restore drills and measured recovery objectives
- A reviewed forward-only Prisma schema migration plan and runtime
  rollback procedure for the exact release versions
- A persistent staging environment with actual HTTPS/TLS reverse proxy,
  cookie/CSRF, auth, Redis degradation, SMTP and key user journeys
- Production server network controls, secrets, persistent avatar volume,
  monitoring, routing and proof of delivered alerts
- An approved change ticket, distinct reviewer/on-call, rollback
  triggers, and a staffed maintenance window

The imported source project included a local operator approval helper.
Its exported offline function can **structurally evaluate** private
approval references, but it cannot independently prove external
operator evidence exists; no monorepo deployment action invokes it.
A separate [operator-only read-only preflight](production-host-preflight.md)
now requires an explicit successful GitHub Actions review run ID and compares
the local release receipt byte-for-byte (SHA-256) against that run's original
latest-attempt artifact. It also checks private backup archive integrity and
cached images, but cannot grant deployment approval or substitute for an
external restore drill. There is **no automatic or authorized production
deployment** wired to the monorepo. Do not interpret a test fixture with a synthetic `GO` as
actual authorization.

After a real successful manual review, keep the old API repository as
the operational source of truth until a separately approved cutover
and observation period. The next step is a final signed release/cutover
runbook review and real staging evidence; only a human can authorize
changing production traffic.
