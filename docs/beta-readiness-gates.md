# OVRANTO — Closed Beta GO/NO-GO evidence matrix

**Status:** PRE-BETA **NO_GO** / evidence collection required. **Owner decision:** not recorded.  
**Scope:** first controlled **free, adult-only, Ukraine-first Beta** with 5–10 independent trainers and their athletes; four full weeks **per activated participant**.  
**Source snapshot:** `main` at [2c79ed1 (2026-11-22)](https://github.com/sauron9521/gym-platform/commit/2c79ed1c0474b04b33b79c87ffd84953503ab6e7).  
**Owning Issue:** [#352](https://github.com/sauron9521/gym-platform/issues/352); [M07 Epic #323](https://github.com/sauron9521/gym-platform/issues/323); [master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353).  
**Authority:** [S01](product-strategy/s01-product-strategy-v1.md), [S03](product-strategy/s03-privacy-data-ownership-v1.md), [S04](product-strategy/s04-legal-compliance-v1.md), [S05](product-strategy/s05-security-trust-v1.md), [S06](product-strategy/s06-production-reliability-v1.md), [S07](product-strategy/s07-product-analytics-experiments-v1.md), [S08](product-strategy/s08-go-to-market-v1.md).

> **A process template, not an approval.** The rows below identify evidence *needed*, not evidence *obtained*. The existence of source code, docs, green CI, Playwright tests, synthetic fixtures, workflow YAML or a merged PR is not proof of actual HTTPS staging, legal eligibility, signed native binaries, device-level QA, restore or operational readiness. This document authorizes **no** invitations, charges, deployment, security bypass, Issue closure or production cutover. The sole product owner must make an explicit, dated decision using verified evidence. **Default and current decision: NO_GO.**

## 1. Decision model and accountable owner

- **Decision being considered:** invite the first real participants to the *free* closed Beta, not approval of a paid launch or a deployment by itself.
- **Accountable decision maker:** OVRANTO owner. Evidence owners may be owner/operator, technical verifier, lawyer or accountant as appropriate; record their actual identities in **restricted evidence**, never invent names or signatures.
- **Separate approvals:** (1) S04 **L1 Beta Legal**, (2) S05 **Security**, (3) S06 **Reliability/operations**, (4) product/device/privacy readiness, then (5) **explicit owner Beta GO**. Passing one cannot imply another.
- **Evaluation rule:** any required row still **PENDING**, **FAIL**, **UNKNOWN** or lacking a verifiable, current artifact => **NO_GO**. A justified **N/A** needs an applicability rationale and owner acceptance; it cannot waive legal, data-integrity, security or native acceptance obligations.
- **Evidence record for each row:** gate ID; PASS/FAIL/PENDING/N/A; actual owner/verifier; exact build/commit or signed image digest; environment/origin and isolation; UTC test date; test procedure and raw result; retained artifact identifier/access-controlled link; validity or expiry/retest condition; unresolved defects and remediation Issue. An Issue or PR link is **ownership/progress**, not the artifact itself.
- **Evidence hygiene:** keep secrets, user PII, test-account credentials, device identifiers, backups, logs with sensitive payloads, private legal advice and real domains that must remain confidential outside this public repo. Link only sanitized reports or access-controlled evidence references with the minimum necessary detail.
- **Freshness:** re-check evidence on the exact release candidate and relevant environment; redo affected gates after changes to auth, DB schema, binary/runtime, infrastructure or privacy policy. Do not transpose prior commit tests to a new release automatically.

## 2. Pre-invitation mandatory gate matrix

All rows are **PENDING** as of the stated source snapshot unless an independently verified artifact and approved gate decision are attached to the release record. This is an evidence inventory, **not** an assertion that no local tests or operator work have ever occurred.

<!-- prettier-ignore -->
| ID | Gate / acceptance evidence required | Existing owners and runbooks | Status |
| --- | --- | --- | --- |
| L1 | Named eligible legal operator, authority/contact, legal and accounting conclusions as applicable; lawyer-reviewed UA+EN Terms, Privacy Notice, Trainer Terms, content and physical-safety/non-medical terms; verified acceptance **version/time/actor**, separate notice and purpose-specific optional consents | [S04 L1](product-strategy/s04-legal-compliance-v1.md), [S03](product-strategy/s03-privacy-data-ownership-v1.md) | PENDING |
| L2 | Adult-only Beta and proportionate lawful eligibility evidence; vendor register/data transfer review; accessible privacy and support channels; report/block/appeal and unsafe-advice process; **no payment, card, subscription or paywall** | [S04 L1](product-strategy/s04-legal-compliance-v1.md), [S05](product-strategy/s05-security-trust-v1.md), [#556](https://github.com/sauron9521/gym-platform/issues/556) | PENDING |
| P1 | Athlete ownership, scope-limited Trainer access, revoke/termination semantics, historical read-only program license, account rights (access/export/rectification/deletion) and backup/offline anti-resurrection; positive **and negative** tests with authorized and unauthorized users | [S03](product-strategy/s03-privacy-data-ownership-v1.md), [#288](https://github.com/sauron9521/gym-platform/issues/288) | PENDING |
| S1 | Endpoint × capability × object permission matrix, BOLA/IDOR and cross-account checks, role-change/session revocation, Trainer/Athlete dual-capability behavior; no critical unremediated issue | [#288](https://github.com/sauron9521/gym-platform/issues/288), [#291](https://github.com/sauron9521/gym-platform/issues/291), [#361](https://github.com/sauron9521/gym-platform/issues/361) | PENDING |
| S2 | Privileged Admin session isolation, MFA/step-up and bypass/expiry tests, audit retention/redaction/authorized reads; incident escalation and minimal abuse reporting/appeal | [#289](https://github.com/sauron9521/gym-platform/issues/289), [#290](https://github.com/sauron9521/gym-platform/issues/290), [#295](https://github.com/sauron9521/gym-platform/issues/295), [S05](product-strategy/s05-security-trust-v1.md) | PENDING |
| S3 | Secrets/workflow permissions and deployment-environment review, mobile local-data/account isolation, security test log, residual-risk decision and separate security signoff | [S05](product-strategy/s05-security-trust-v1.md), [#324](https://github.com/sauron9521/gym-platform/issues/324), [#345](https://github.com/sauron9521/gym-platform/issues/345) | PENDING |
| D1 | Two **real** signed/staging-isolated Android and iOS builds/installations and device QA: authentication/refresh, edit/complete set, interrupted PATCH, committed write + lost response, resume/reopen, offline/reconnect, logout/account switch, duplicate tap and expired session; compare **exact server mutation counts** | [#324](https://github.com/sauron9521/gym-platform/issues/324), [#348](https://github.com/sauron9521/gym-platform/issues/348), [#349](https://github.com/sauron9521/gym-platform/issues/349), [native QA guide](mobile/native-testing.md) | PENDING |
| D2 | Data integrity: no silent set overwrite, duplicate or loss; server-authoritative read-only reconciliation of uncertain writes; explicit 409 conflict handling; durable account-scoped drafts and restart proof for the agreed Beta offline experience | [#322](https://github.com/sauron9521/gym-platform/issues/322), [#344–347](https://github.com/sauron9521/gym-platform/issues/344), [S06](product-strategy/s06-production-reliability-v1.md) | PENDING |
| F1 | Actual Trainer create/review/publish/version/assign → Athlete accept/execute/record/feedback → Trainer review flow through real API; negative access tests, stable legacy links and session handling | [#338](https://github.com/sauron9521/gym-platform/issues/338), [#355](https://github.com/sauron9521/gym-platform/issues/355), [#365](https://github.com/sauron9521/gym-platform/issues/365), [#366](https://github.com/sauron9521/gym-platform/issues/366), [#369](https://github.com/sauron9521/gym-platform/issues/369) | PENDING |
| O1 | Real isolated HTTPS staging, TLS/cookie/CSRF, auth/API/Web native connectivity, SMTP, Redis fail-closed and full critical read/**write** journeys with timestamps and source image/build identity | [#351](https://github.com/sauron9521/gym-platform/issues/351), [staging smoke](staging-live-smoke.md), [staging inventory](staging-readiness-inventory.md) | PENDING |
| O2 | Encrypted off-host PostgreSQL/**private media** backup, **actual isolated restore** and anti-resurrection checks; recovery proof meets **Beta RPO ≤1 hour, RTO ≤4 hours**, including working auth and critical read/write after restore | [#351](https://github.com/sauron9521/gym-platform/issues/351), [backup/restore](backup-restore-operations.md), [S06](product-strategy/s06-production-reliability-v1.md) | PENDING |
| O3 | Exact signed-release identity, compatible two-release runtime rollback after forward Prisma migration, documented abort/recovery, isolation from production and independently inspected artifacts; no reverse-database-migration assumption | [#351](https://github.com/sauron9521/gym-platform/issues/351), [rollback guide](staging-two-release-rollback.md), [release review](production-readiness-review.md) | PENDING |
| O4 | Measured workload baseline and verified alerts: independent synthetic critical-journey checks, p95 / 5xx / **429 separately**, DB saturation and failed writes, mobile crash/sync failures; **two independent delivered P0/P1 alert channels** to owner, incident and stop drills | [#316](https://github.com/sauron9521/gym-platform/issues/316), [#350](https://github.com/sauron9521/gym-platform/issues/350), [S06](product-strategy/s06-production-reliability-v1.md), [observability guide](production-observability.md) | PENDING |
| Q1 | Cross-product accessible/responsive UA+EN critical paths, native keyboard/safe areas, realistic operator support, accurate landing/signup availability, no inaccessible download claim; reviewer-attached browser/device evidence | [#385](https://github.com/sauron9521/gym-platform/issues/385), [#389](https://github.com/sauron9521/gym-platform/issues/389), [#393](https://github.com/sauron9521/gym-platform/issues/393) | PENDING |
| A1 | Privacy-safe, server-authoritative Trainer/Athlete activation/W4 event dictionary and full-window cohort fixtures; validation of counts without sensitive workout payloads or fabricated zeros | [S07](product-strategy/s07-product-analytics-experiments-v1.md), [S01](product-strategy/s01-product-strategy-v1.md) | PENDING |
| G1 | Named owner review of **all** above release-specific evidence, documented acceptable residual risk, support/stop plan, independent L1/S05/S06 decisions and explicit **GO** for precisely scoped free Beta | [#352](https://github.com/sauron9521/gym-platform/issues/352), [#323](https://github.com/sauron9521/gym-platform/issues/323) | PENDING |

**Gate semantics:** `Q1` and `A1` are pre-Beta acceptance of necessary UX and **ability to measure**; they do not require W4 results before the participants begin their individual four-week windows. A source-level test, prepared workflow or link to its instructions leaves the row **PENDING** until execution evidence is verified. No implicit PASS from green CI.

## 3. Reliability thresholds and performance alert acceptance

**Already approved internal objectives, not achieved service promises** ([S06](product-strategy/s06-production-reliability-v1.md)):

<!-- prettier-ignore -->
| Measure | First free Beta decision target | Verification requirement |
| --- | --- | --- |
| RPO | **≤ 1 hour** | Dated isolated restore with identified recovery point, PostgreSQL plus required durable components and media |
| RTO | **≤ 4 hours** | Measured until auth, API and critical Trainer/Athlete read/write journeys succeed after restore |
| Availability | **99.5%**, rolling **30 days**, including planned maintenance as unavailable | Independently configured synthetic critical-journey SLIs; clearly flag incomplete observation as **INSUFFICIENT_EVIDENCE**, not PASS |
| p95 latency | **TBD after staging measurements**, per critical read/write/route class | Identify test load, sample duration, request count, route-specific p95 and **owner-approved** limit |
| 5xx / write failure rate | **TBD after measured baseline** | Distinguish 5xx, business validation failures, lost writes and server-acknowledged writes; owner-approved alert/stop limits |
| 429 / throttling | **TBD and tracked separately** | Measure 429 by scenario and caller class, test abuse protection and legitimate Trainer/Athlete flows; owner-approved rate and alert action |
| Alert delivery | Two independent P0/P1 channels with actual delivered test | Receiver, timestamp, routing/deduplication, escalation and incident stop/rollback action |

**No invented performance gates.** S06 deliberately requires p95/error/429 values derived from staging tests and adopted **before** owner Beta GO, not arbitrary universal numbers. Record baseline and signed thresholds in restricted release evidence or a reviewed follow-up operational runbook. A provisional Prometheus rule, passing promtool or successful `/health` alone is insufficient. Rolling-30-day availability is a target and measurement policy; a shorter clean staging window cannot be misrepresented as 30-day production history.

Stop intake or the Beta when a critical security/privacy failure, confirmed duplicate/lost workout, uncontrolled 409/ambiguous write, sustained critical-write outage, unsafe migration, inaccessible alert path or breached **approved** health thresholds occurs. No unattended destructive rollback or DB restore. Owner initiates the documented response and records the post-incident decision.

## 4. Evidence manifest — complete per release candidate, outside Git

Use a private, access-controlled record; the following is an **empty template**, not test output:

<!-- prettier-ignore -->
| Field | Required value |
| --- | --- |
| `decision_id`, `candidate_sha`, `signed_artifact_digest` | Unique review ID; exact commit; runtime / APK / iOS identifiers as applicable |
| `environment`, `isolation_proof` | Verified staging origins, tenant/test-account isolation and no production write path |
| `evidence_collected_at_utc`, `verifier` | Real dated execution, accountable verifier and review timestamp |
| `gate_id`, `result`, `acceptance` | One row per L1…G1 with PASS/FAIL/PENDING/N/A and measurable pass condition |
| `evidence_reference`, `source_run`, `defect_issue` | Restricted artifact location, workflow/device/restore receipt, outstanding blocker |
| `valid_until_or_retest_on`, `residual_risk` | Version/environment validity, explicit risk disposition |
| `legal_l1_decision`, `security_decision`, `reliability_decision` | Three distinct approvals with proof; never inferred from Docs/CI |
| `owner_beta_decision`, `signed_at_utc`, `scope` | Final explicit NO_GO/GO, identity, date, approved trainer cohort and conditions |

Owner review should validate references rather than simply accepting field presence. The repository's [staging evidence inventory](staging-readiness-inventory.md) checks **syntactic presence only** and always remains NO_GO. The [production evidence review](production-readiness-review.md) also intentionally never authorizes a deployment.

### Current evidence register — source snapshot only

<!-- prettier-ignore -->
| Evidence class | What was verified at 2c79ed1 | Release acceptance |
| --- | --- | --- |
| Source build | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45075022427) and [Web / Integration E2E](https://github.com/sauron9521/gym-platform/actions/runs/45075022434) succeeded on this main SHA | **Not** native, legal, staging, recovery or owner signoff |
| Manual workflow history | The retrieved GitHub `workflow_dispatch` history contained Roadmap milestone sync and OVRANTO visual review runs, **not** a verified staging/native/rollback release chain | **PENDING** external/manual evidence |
| Mobile | Reconciliation code and Maestro harness exist; [#324](https://github.com/sauron9521/gym-platform/issues/324) still requires actual Android/iOS evidence and exact server PATCH counts | **PENDING** |
| Recovery and rollout | Runbooks and offline safety validators exist; [#351](https://github.com/sauron9521/gym-platform/issues/351) awaits real restore/rollback/staging evidence | **PENDING** |
| Legal/security | S03–S06 are approved policies, not executed L1/legal or security acceptance | **PENDING** |

This snapshot is not an exhaustive inventory of private work. Any operator who performed tests outside GitHub can supply dated, independently verifiable evidence without publishing secrets. Reassess on every candidate rather than freezing this snapshot as perpetual truth.

## 5. Beta operation, W4 cohorts and **separate** exit decision

**Before first invitation:** G1 must be explicitly GO, with all applicable pre-invitation gates proved. The Beta is limited to **5–10 trainers and their consenting athletes**, **adult-only** pending separate legal approval, **free**, no cards/charges/paywall or automatic paid conversion. Any waitlist is a separate lawful intake, not permission to onboard users before GO. Track actual invitation, activation and observation start dates.

**During Beta:** stop/recover through the runbooks for critical incidents. Each participant receives a full **individual 28-day** window after activation, not a shared calendar-based four-week deadline. Preserve actual training writes and privacy rights.

**At exit (not a pre-invitation hurdle):** measure independently, **Trainer W4 ≥50%** and **Athlete W4 ≥50%** on **days 22–28** of each activation; denominators include **only activated participants with full completed W4 windows**. Report numerator, denominator and as-of date for both, plus qualifying server-side activity and small-sample/consent limitations. A W4 shortfall calls for investigation, **not automatic scaling**. No paid, international, Club, AI or Marketplace GO follows from Beta GO or W4 alone ([S01](product-strategy/s01-product-strategy-v1.md), [S07](product-strategy/s07-product-analytics-experiments-v1.md), [S08](product-strategy/s08-go-to-market-v1.md)).

## 6. Review workflow and follow-up ownership

1. Recheck current `main`, [#352](https://github.com/sauron9521/gym-platform/issues/352) and neighboring Issues before each small implementation slice. Keep **#352 OPEN** until the actual Beta decision evidence and acceptance criteria are fulfilled.
2. Attach restricted evidence to the relevant existing Issue: [Admin/security #288–295](https://github.com/sauron9521/gym-platform/issues/288), [mobile #322/#324/#344–349](https://github.com/sauron9521/gym-platform/issues/324), [Trainer #338/#355/#365–369](https://github.com/sauron9521/gym-platform/issues/355), [staging/restore #351](https://github.com/sauron9521/gym-platform/issues/351), [UX #385/#389](https://github.com/sauron9521/gym-platform/issues/389). Don't close an Issue for scaffold/test-plan alone.
3. One small reviewable PR at a time. CI must pass for implementation changes; native QA, legal and operational work each have their separate verification. Only the owner merges and authorizes real invitations.
4. On a qualifying candidate, record independent **L1**, **S05**, **S06** and product/device acceptance, plus explicit signed owner **GO** with exact scope, start and stop conditions. Otherwise retain **NO_GO**.
5. **Separate future gates:** S04 L2 / [#498](https://github.com/sauron9521/gym-platform/issues/498) / [#512](https://github.com/sauron9521/gym-platform/issues/512) for Web Billing; S04 L3 / [#499](https://github.com/sauron9521/gym-platform/issues/499) / [#517](https://github.com/sauron9521/gym-platform/issues/517) for store purchases; [#560](https://github.com/sauron9521/gym-platform/issues/560) for paid business operations. **No commercial feature is a substitute for Beta safety.**

**Current decision: NO_GO.** This Markdown file is a candidate evidence procedure only. Merging it does not change that decision.
