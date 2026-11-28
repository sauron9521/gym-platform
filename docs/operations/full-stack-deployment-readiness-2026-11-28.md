# DEP11 — OVRANTO full-stack deployment readiness review

Review date: 2026-11-28 (UTC). Source snapshot:
[48e92a9](https://github.com/sauron9521/gym-platform/commit/48e92a9f3c0a920caa349a5c5f22c55543bf72ca).
This is a technical evidence reconciliation, not an independent legal,
security or reliability signoff. **Deployment: NO_GO. Closed Beta:
NO_GO. Horizontal scale-up: not authorized.** No owner GO recorded here.

Canonical requirements: [deployment plan](full-stack-deployment-plan.md),
[Beta matrix](../beta-readiness-gates.md), [S06](../product-strategy/s06-production-reliability-v1.md).
Ownership: #393, #323, #351, #352; no new epic, milestone or issue closure.

## Review scope and provenance

- Inspected the exact main tree, deployment and Beta matrices, merged delivery
  history, workflows, operational runbooks and existing acceptance issues.
- The public GitHub Actions history returned 12 manual dispatch runs at review
  time: resource-shadow monitoring, tooling audit, roadmap sync and visual
  review. No signed release/publisher/staging/native/rollback execution was
  present in that returned history. This does not rule out restricted or
  externally retained evidence.
- Exact-main [CI](https://github.com/sauron9521/gym-platform/actions/runs/46117493918)
  and [Web Integration](https://github.com/sauron9521/gym-platform/actions/runs/46117493913)
  were in progress at initial inspection. Do not infer success from merge.
- PR descriptions document local synthetic execution; they are historical
  development evidence, not independent candidate/environment acceptance.
  No live infrastructure, provider console, secrets, device logs or private
  legal artifacts inspected; no new runtime experiment performed by this review.

## Implementation reconciliation

| Slice | Merged source evidence | Technical status                                                    | Remaining release-specific evidence                                                     |
| ----- | ---------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| DEP01 | #1003                  | Plan merged                                                         | Owner/provider decisions                                                                |
| DEP02 | #1005                  | Landing standalone pilot                                            | Approved public indexing/analytics and deployed origin                                  |
| DEP03 | #1007                  | Athlete Web standalone pilot                                        | Real cookie/CSRF and authenticated flows                                                |
| DEP04 | #1008                  | Trainer standalone pilot                                            | Real builder/publish/assign/review flow                                                 |
| DEP05 | #1009                  | Admin standalone pilot                                              | Actual MFA/step-up and privileged realm acceptance                                      |
| DEP06 | #1010                  | Isolated Compose rehearsal                                          | Real isolated staging host and protected configuration                                  |
| DEP07 | #1011                  | Local-CA Caddy candidate                                            | Public TLS, renewal, DNS, Cloudflare trust boundary                                     |
| DEP08 | #1012                  | Signed six-image pipeline implemented                               | Exact source CI, actual attestations/SBOM/scans, immutable registry digests             |
| DEP09 | #1014, #1015           | Partial: disposable HTTPS, Redis, SMTPS                             | Signed rehearsal execution, external staging, native and authenticated writes           |
| DEP10 | #1016–#1020            | Partial: local recovery, budget, monitoring, load and replica proof | Off-host encrypted recovery, real RPO/RTO, alert delivery, workload and signed rollback |
| DEP11 | This review            | Review only                                                         | Independent approvals and explicit owner decision                                       |

The five DEP10 implementation slices are merged; their operational acceptance
is not complete. DEP01–08 implementation preparation does not mean that
eight deployment gates have passed.

### Local technical evidence ledger

| Slice       | Reported synthetic result                                                                                                                         | What it does not prove                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| #1014–#1015 | Local CA TLS, anonymous denial, Redis readiness 503/recovery, actual SMTPS sink/allowlist                                                         | Public TLS, real external SMTP delivery, signed images, session/write journeys               |
| #1016       | PostgreSQL and avatar restore, matching migration ledger/hash, tamper/nonempty-target refusal                                                     | Encrypted off-host backup, real recovery point, application cutover                          |
| #1017       | PostgreSQL 100 max, 97 usable, 31 planned for one API incl reserves, 66 remaining                                                                 | Provider limits, measured saturation, actual peak concurrency                                |
| #1018       | Nine HTTPS probes; four readiness failures with Redis stopped, all recover; four rule tests                                                       | Independent external observer, actual receiver delivery, 30-day SLI                          |
| #1019       | 76 + 301 requests at 5/20 requests per second, zero errors/drops; p95 45.27/43.86 ms, p99 55.55/53.33 ms                                          | Representative authenticated read/write load, latency SLO, production capacity               |
| #1020       | Two actual same-image containers, round-robin, 60 successful anonymous catalogue reads then 429, two observed DB clients, stop/restart/scale-down | Cross-version rollback, writes, shared-media safety, separate-host failover or zero downtime |

The pilot deliberately preserves single-instance production, default-off
notification dispatch/retention, no automatic migration reset and no paid
features. The existing API-only signed two-release rollback procedure is
not replaced by same-image replica restart.

## Beta gate reconciliation

All 16 mandatory rows from the canonical matrix remain PENDING: no
release-specific verified acceptance artifact or independent decision has
been established in this review. This is not a new gate schema.

| Gate | Evidence or implementation observed                             | Remaining evidence / owner issues                                                                                   |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| L1   | Approved S04 policy                                             | Named eligible operator and lawyer-reviewed documents, versioned acceptance                                         |
| L2   | S04/S05 policy; #556 open                                       | Adult eligibility, vendors/transfers, support/moderation/appeal, free-only proof                                    |
| P1   | S03 and account-deletion module; #948 open                      | Permission/revocation, privacy rights and anti-resurrection; #288/#948                                              |
| S1   | Existing capability/access regressions                          | Release-specific endpoint/object/role matrix; #288/#291/#361                                                        |
| S2   | Admin image smoke; #290 and #948 open                           | Actual MFA/step-up, bypass/expiry, audit and incident handling                                                      |
| S3   | Signed workflow contracts and native scaffolding                | Environment/secret review, device isolation, independent S05 signoff                                                |
| D1   | EAS/Maestro scaffolding; #324/#348/#349 open                    | Installed signed Android and iOS builds, exact mutation counts                                                      |
| D2   | Read-only reconciliation code                                   | Device restart/offline/conflict/write integrity; #322/#324/#344–347                                                 |
| F1   | Trainer selector/assignment and workspace routes; #365 open     | Complete actual builder/publish/assign/execute/review journey; #355/#365/#366/#369                                  |
| O1   | DEP06–09 local HTTPS/SMTP/Redis rehearsals                      | Actual isolated HTTPS staging, signed identity, real auth/read/write/mobile; #351                                   |
| O2   | DEP10a synthetic restore                                        | Encrypted off-host database and media, measured RPO/RTO, anti-resurrection and post-restore writes; #351            |
| O3   | DEP08 signed workflow code; existing API-only rollback workflow | Two exact compatible signed releases, forward migration and previous-runtime recovery; #351                         |
| O4   | DEP10b/c/d/e local budget/probes/load/replicas                  | Representative workload, approved p95/5xx/429 limits, independent alert delivery, mobile crash/sync; #316/#350/#351 |
| Q1   | Standalone web pilot and visual review history                  | Responsive, accessible UA/EN release/device journeys; #385/#389/#393                                                |
| A1   | S07 policy and measurement requirements                         | Server-authoritative activation/W4 evidence and privacy-safe cohort fixtures                                        |
| G1   | NO_GO procedure                                                 | Verified independent L1/S05/S06 and product/device decisions, explicit owner GO; #352                               |

The source review does not establish private legal status, trademark
clearance, DNS ownership, actual consent records or operational control.
W4 results are a Beta-exit measure, not a pre-invitation requirement.
Multi-replica acceptance (#921/#922/#923) is a scale-up requirement, not
an additional mandatory Beta gate for the approved single-instance scope.

## Ordered next actions (existing issues)

The following order is a proposed execution sequence, not authorization.
Legal, product and security work can proceed independently while the
operator prepares staging.

| Order | Work package                             | Existing ownership                    | Acceptance / dependency                                                                                                                                |
| ----- | ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Owner infrastructure and legal decisions | #393/#351/#352, S04/S06               | Select region/provider/budget, staging host map, DNS/TLS approach, operator and review path; no live changes without approval                          |
| 2     | First immutable pilot release            | #323/#351                             | Exact green main CI, manual release-full-stack then publish-full-stack-ghcr; verify six digests, SBOM/scans and signatures; no mutable tag deployment  |
| 3     | Signed disposable rehearsal              | #351                                  | Run staging-full-stack on exact approved release/publisher IDs; retain sanitized run receipt; no external staging claim                                |
| 4     | Isolated real staging                    | #351/#393                             | Separate data, secrets, SMTP, storage and DNS; verified TLS/Cloudflare boundaries; read/write/auth/CSRF/native connectivity                            |
| 5     | Critical product and security gates      | #290/#948/#365/#366/#369              | Actual step-up and negative authorization, full Trainer/Athlete lifecycle, privacy and deletion semantics                                              |
| 6     | Native acceptance                        | #324/#348/#349/#350                   | Approved EAS project and isolated signed builds; actual Android/iOS and exact server mutation proof                                                    |
| 7     | Recovery and release rollback            | #351                                  | Encrypted off-host backups and isolated restore, measured RPO <= 1h/RTO <= 4h, compatible two-release runtime rollback; no automatic reverse migration |
| 8     | Workload and alerts                      | #316/#350/#351/#922                   | Representative populated staging workloads, p95/5xx/429 separately, measured pool waits, two independent delivered alert channels and stop drill       |
| 9     | Privacy, UX, legal and analytics review  | #288/#556/#385/#389/#352, S03/S04/S07 | Verified required artifacts and independent signoffs; scope remains free adult-only UA-first                                                           |
| 10    | Owner decision                           | #352                                  | Review all 16 rows on exact candidate; explicit decision with date, scope, residual risk and stop conditions                                           |

Before each operation recheck current main, active PRs, evidence freshness and
permission. Attach actual artifacts to the canonical issue/restricted record.
No production credentials or real user data in Git. No paid launch, AI,
marketplace, indexing activation, user invitations or horizontal scale-up
is authorized by this review.

**Disposition:** implementation preparation advanced; deployment and Beta
remain NO_GO. The next decision is owner-approved infrastructure scope and
a separate explicit authorization to run the immutable pilot release chain.
