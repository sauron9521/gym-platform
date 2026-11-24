# OVRANTO — Post-S12 implementation baseline audit (2026-11-22)

**Status:** AUDIT BASELINE / OWNER REVIEW; **not** Beta or production GO, and **not** authorization to merge, mass-close, reprioritize or implement Issues.

**Source revision:** [main \`7aaa27ca26757ead9e918c0b65585f4cf8e73448\`](https://github.com/sauron9521/gym-platform/commit/7aaa27ca26757ead9e918c0b65585f4cf8e73448) (2026-11-22).

**Strategy:** [S01–S12 APPROVED + RECORDED](../product-strategy/README.md), [#588](https://github.com/sauron9521/gym-platform/issues/588). **Technical owner:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Evidence discipline:** GitHub CI and source files establish **repository state**, not deployed environments, native-device QA, contracts, actual privacy-law compliance, live billing, backup restoration or production readiness. This audit is a **triage baseline and proposed sequencing**, not a claim that 178 open Issues were fully code-reviewed or their acceptance criteria all proven unmet. No readiness percentage is inferred. The solo owner alone reviews/merges PRs and issues explicit GO/NO-GO.

## 1. Method and scope

Verified the public GitHub repository/default branch and app directories; [12 canonical product strategies](../product-strategy/README.md); [master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353); open PR list; issue search totals/priority/phase-label distributions; actual milestone assignments for M01–M07; selected critical Issues and their acceptance; release/staging/device runbooks and recent Actions workflow runs.

**Not proven by this baseline:** full line-by-line code coverage for each task, local environment/device status, external legal/trademark ownership, seller/provider contracts, staging secrets, protected deployment environment configuration, actual QA on physical devices, production traffic/availability and restore drills. Do not infer absence of evidence outside the inspected sources as proof that an operator never ran a local test. Re-check current main and Issues before implementing any slice.

## 2. Verified snapshot

| Measure                                  | Verified snapshot                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Default branch                           | \`main\`, \`7aaa27ca2\`                                                                        |
| Strategic decisions                      | **S01–S12 APPROVED + RECORDED**, policy only                                                   |
| Open pull requests                       | **0**                                                                                          |
| Open Issues, after narrow #564 closure   | **178**                                                                                        |
| Closed Issues, after narrow #564 closure | **15**                                                                                         |
| Open P0 / P1 / P2-labelled Issues        | **34 / 123 / 16** (5 without priority)                                                         |
| M01–M07 open Issues                      | **93**, phase labels and actual GitHub milestones match                                        |
| M08 AI Readiness                         | **6** open, deliberately **unassigned** to milestone (not enabled)                             |
| No GitHub milestone                      | **85** open (includes M08's 6; 79 other unassigned)                                            |
| \`main\` CI                              | [SUCCESS run 45073365294](https://github.com/sauron9521/gym-platform/actions/runs/45073365294) |
| \`main\` Web / Integration E2E           | [SUCCESS run 45073364928](https://github.com/sauron9521/gym-platform/actions/runs/45073364928) |

Six actual apps in [\`apps/\`](https://github.com/sauron9521/gym-platform/tree/main/apps): \`api\`, \`web\`, \`trainer\`, \`mobile\`, \`admin\`, \`landing\`. The API contains core auth, users, exercises, trainer–athletes, training-programs, workouts and workout-analytics modules. Source presence and CI **do not** establish end-to-end launch readiness.

## 3. Milestone reconciliation

All **93 currently open** issues labelled with active M01–M07 phase are assigned the matching real GitHub milestone; no mismatched or unassigned Issue was observed **within those seven phases**.

| Phase             | Open   | Summary                                                       |
| ----------------- | ------ | ------------------------------------------------------------- |
| M01               | 10     | Identity / Admin security                                     |
| M02               | 12     | OVRANTO brand / cross-app UX                                  |
| M03               | 19     | Platform core / shared contracts                              |
| M04               | 20     | Athlete product                                               |
| M05               | 15     | Trainer product                                               |
| M06               | 11     | Mobile reliability / offline                                  |
| M07               | 6      | Native QA / staging / Beta gate                               |
| **M01–M07 total** | **93** | Actual issue→milestone assignments checked                    |
| M08 AI readiness  | 6      | phase-labelled, no milestone by approved policy               |
| No phase M01–M08  | 79     | Most are E21 Billing, E22 Governance, Notifications, Roadmaps |

**Decision recommended for owner review:** keep M01–M07 stable; do not automatically assign all 79 items to current milestones. M08 stays off by default. Prioritize **Beta-specific readiness** independently of generic \`priority:p0\`, because **17 P0-labelled tasks without phase** relate largely to **future paid Billing/Governance**, not prerequisites for the free initial Beta. Proposed status views: \`Beta blocker\`, \`Beta supporting\`, \`Post-Beta commercial\`, \`Deferred\` and \`Evidence pending\`; these are proposed triage views, **not created labels or milestones**.

## 4. CI versus staging/production evidence

The current \`main\` commit is green for CI and Web integration, including checks such as formatting, API e2e and Tooling Vitest. However [production-readiness-review.md](../operations/production-readiness-review.md), [staging-live-smoke.md](../operations/staging-live-smoke.md), [staging-readiness-inventory.md](../operations/staging-readiness-inventory.md) and [native-testing.md](../mobile/native-testing.md) explicitly require additional operator-controlled evidence.

At audit time, the available repository Actions history reported **five** \`workflow_dispatch\` runs: three related to the Roadmap milestone sync (two successful, one canceled) and two successful visual-review runs on **2026-11-19**. No manually dispatched **staging live smoke, signed GHCR release/two-release rollback, production evidence review or device-level native acceptance workflow** appeared in this retrieved history. This is **not** proof that no out-of-band local device test ever occurred; it means no qualifying GitHub evidence was verified.

The production-readiness review workflow is **read-only and NO-GO by design**; its successful test or artifact cannot itself approve production. [API migration audit](api-migration-audit.md) likewise identifies **production cutover NO-GO** and warns that the Prisma baseline reset cannot serve as an upgrade migration for a pre-baseline deployment.

**Current evidence-based conclusion:** **Do not claim Beta GO, paid GO or production GO.** CI GREEN ≠ actual HTTPS staging, data restore, real-device workout PATCH reconciliation, signed rollback, privacy/legal acceptance or operator sign-off.

## 5. Beta critical path — proposed owner priorities

| Order  | Owning Issues                                                                                                                                                                                                                                              | Required evidence / output                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B0** | [#352](https://github.com/sauron9521/gym-platform/issues/352), S04/S05/S06, [#560](https://github.com/sauron9521/gym-platform/issues/560)                                                                                                                  | One **explicit owner Beta GO/NO-GO matrix** with mandatory legal, security, device, backup, UX, observability and rollback evidence links; #352 is currently P2 and should be **reviewed for launch-blocker priority**, not silently relabelled                              |
| **B1** | [#288](https://github.com/sauron9521/gym-platform/issues/288), [#289](https://github.com/sauron9521/gym-platform/issues/289), [#290](https://github.com/sauron9521/gym-platform/issues/290), [#295](https://github.com/sauron9521/gym-platform/issues/295) | Permission matrix, sensitive Admin authorization/session/step-up/audit evidence. Decide which privileged Admin actions must be enabled at free Beta; those exposed need verified safety                                                                                      |
| **B2** | [#324](https://github.com/sauron9521/gym-platform/issues/324), [#348](https://github.com/sauron9521/gym-platform/issues/348), [#349](https://github.com/sauron9521/gym-platform/issues/349)                                                                | Real signed Android/iOS preview builds, isolated HTTPS staging, authorized test accounts, actual Maestro/native interrupted PATCH and app resume tests, **exact server PATCH counts**. Already merged read-only reconciliation/Maestro scaffold is **not** device acceptance |
| **B3** | [#351](https://github.com/sauron9521/gym-platform/issues/351), [#323](https://github.com/sauron9521/gym-platform/issues/323), S06                                                                                                                          | Timestamped isolated staging smoke, PostgreSQL/avatar backup **restore**, TLS/SMTP/Redis/alerts where applicable, two-release compatible rollback evidence. Real operator artifacts, not mocked fixture IDs                                                                  |
| **B4** | [#322](https://github.com/sauron9521/gym-platform/issues/322), [#344–347](https://github.com/sauron9521/gym-platform/issues/344), [#385](https://github.com/sauron9521/gym-platform/issues/385)                                                            | Close gaps that affect **agreed Beta offline reliability**: account-scoped draft persistence, revision conflicts and no silent overwrite. Do not label unshipped offline functionality Beta-ready. Include native UX/keyboard/safe-area evidence                             |
| **B5** | [#338](https://github.com/sauron9521/gym-platform/issues/338), [#355](https://github.com/sauron9521/gym-platform/issues/355), [#369](https://github.com/sauron9521/gym-platform/issues/369), S01–S03                                                       | Validate Trainer program DRAFT→review→publish→assignment and Athlete actual workout/log/feedback journeys with real API, cross-user negatives, export/revocation expectations and clear acceptance                                                                           |
| **B6** | [#393](https://github.com/sauron9521/gym-platform/issues/393), [#388](https://github.com/sauron9521/gym-platform/issues/388), S08                                                                                                                          | Only truthful brand/landing links for **actually deployed** products, owned domain/TLS, rights/trademark review before public launch. Not a substitute for Beta legal or security gates                                                                                      |
| **B7** | [#352](https://github.com/sauron9521/gym-platform/issues/352)                                                                                                                                                                                              | Review **real evidence** and explicit solo-owner GO; run a controlled **free four-week 5–10 Trainer Beta** only if all applicable gates are met                                                                                                                              |

The table is **proposed sequencing, not proof that each task is wholly unimplemented**. Real operator work may progress in parallel where safe; implementation/PRs are done **one small owner-reviewed PR at a time**. If an issue's acceptance criteria are already satisfied in current main, link the verifying commit/tests and close it rather than reimplementing it. Before actual Beta, legal notices/contract/age-policy requirements from S04 must be verified independently; a Billing merchant checklist for future paid launch is **not a substitute** for the free-Beta legal gate.

## 6. Commercial and deferred work: do not misprioritize

**Post-Beta paid**: [E21 #496](https://github.com/sauron9521/gym-platform/issues/496), [#497](https://github.com/sauron9521/gym-platform/issues/497), [#498](https://github.com/sauron9521/gym-platform/issues/498), [#500–517](https://github.com/sauron9521/gym-platform/issues/500). No live prices, merchant GO or IAP/store approval from strategy signoff. S01 requires **one future Trainer paid**, **one Athlete Pro**, and Athlete Free core; free initial Beta has **no cards/charges/paywall**. Many P0 Billing issues reflect their **future commercial launch** criticality, not free Beta blockers.

**Optional post-Beta product**: [Notifications #563](https://github.com/sauron9521/gym-platform/issues/563) architecture has accepted docs, but no verified runtime Inbox/Outbox/Push; [#565](https://github.com/sauron9521/gym-platform/issues/565) next independent slice. Calendar/local reminders [#321](https://github.com/sauron9521/gym-platform/issues/321) are a separate ownership boundary.

**Deferred**: M08 [AI Readiness #357](https://github.com/sauron9521/gym-platform/issues/357) remains **NO MODEL CALLS**; [AI Integration #358](https://github.com/sauron9521/gym-platform/issues/358) stays HOLD. S10 Health APIs remain independent permission/provider/store-gated. [Marketplace #521–526](https://github.com/sauron9521/gym-platform/issues/521) and [Business Governance #550](https://github.com/sauron9521/gym-platform/issues/550) **do not** authorize Clubs, seller funds flow/payouts, or international commerce without additional legal/security/financial approvals.

## 7. Confirmed reconciliation of stale state

**Verified completion:** [Notifications N01 #564](https://github.com/sauron9521/gym-platform/issues/564) was falsely marked PR-pending, despite owner-merged [PR #584](https://github.com/sauron9521/gym-platform/pull/584) on 2026-11-21. Confirmed all three ADR/event/delivery docs in current main and passed CI; checked its last acceptance criterion and **closed #564 as completed**, without touching any code. Corrected N01 progress in the open parent [#563](https://github.com/sauron9521/gym-platform/issues/563). **Epic #563 remains OPEN**; docs-only completion is not implementation.

**Documentation status drift:** some S01–S12 canonical Markdown / strategy indexes still contain historical \`pending manual merge\` wording from before owner review. [Strategy Roadmap #588](https://github.com/sauron9521/gym-platform/issues/588) correctly records **S01–S12 APPROVED + RECORDED**. Propose a **separate docs-only consistency PR** only after reviewing exact changes; do not rewrite historical v1 approvals or conflate policy with code.

**Keep distinct, not duplicates by title alone:**

- [#297](https://github.com/sauron9521/gym-platform/issues/297) general user preferences vs [#565](https://github.com/sauron9521/gym-platform/issues/565) Notifications settings API.
- [#321](https://github.com/sauron9521/gym-platform/issues/321) calendar/local reminders vs [#563](https://github.com/sauron9521/gym-platform/issues/563) cross-app notification infrastructure.
- [#338](https://github.com/sauron9521/gym-platform/issues/338) human preview/publish UX vs [#377](https://github.com/sauron9521/gym-platform/issues/377) deterministic draft validation (AI readiness, no models).
- [#496](https://github.com/sauron9521/gym-platform/issues/496) individual Billing vs [#525](https://github.com/sauron9521/gym-platform/issues/525) future Organization Billing: distinct payer scopes using **one** planned Billing engine.

**No evidence-backed mass duplicate closure** was justified by the first snapshot. Future exact reconciliation must inspect each candidate's code, merged PRs, acceptance criteria, and resource semantics, then update the **existing** owner Issue rather than creating a competing epic.

## 8. Proposed small-PR delivery protocol

1. **This docs-only audit PR** — capture read-only verified baseline, blocked gates, recommended prioritization; owner review/merge. **Do not relabel 178 Issues or launch anything.**
2. **Next proposed PR: focused Beta GO/NO-GO evidence matrix** tied to [#352](https://github.com/sauron9521/gym-platform/issues/352) (and S04/S05/S06) with checkable links, required evidence, current blocker/owner, explicit \`NO_GO\` default. Must not fabricate test results; include a deterministic read-only validation test only if it materially improves the acceptance.
3. **Then one scoped implementation/evidence slice at a time**, based on the owner-approved next-blocker order: [#324/#348/#349](https://github.com/sauron9521/gym-platform/issues/324) real device+staging tests; [#351](https://github.com/sauron9521/gym-platform/issues/351) restore/reliability; security [#288–295](https://github.com/sauron9521/gym-platform/issues/288); Trainer/Athlete core UX; owners verify acceptance before closing.
4. **After device/operational evidence:** a separate **solo-owner Beta GO/NO-GO**. Only then controlled free Beta; do not use PR CI as a substitute.
5. **Later separate commercial planning:** price/package/legal #497/#498, Billing E21, notifications, Health, AI, B2B and Marketplace according to S01–S12 evidence and budget.

For every implementation PR: check updated main and adjacent open PRs; select **one** existing Issue/acceptance slice; minimal diffs, relevant unit/integration/e2e, security and migrations when applicable; CI; report status and next PR; **owner alone reviews and merges**. Do not automatically close an Issue until acceptance/evidence is confirmed.

## 9. Explicit outstanding audit limitations

- **Milestones:** verified assignment of all open M01–M07 labelled Issues, but not milestone due dates/project-board workflows; phases M08 and future financial/notification scopes intentionally lack active milestone assignment. No new milestone is authorized here.
- **Backend:** no exhaustive controller/service/Prisma audit against each of 178 Issues in this baseline; verify related code in each implementation slice before deciding whether an Issue is already done.
- **Native release:** no verified external EAS/IPA/APK, physical device execution logs or server write-count evidence; operator actions are required.
- **Deployment:** no signed real production readiness/restore/legal GO; all such claims remain unsupported.
- **Metrics:** no real 4-week Beta cohort or billing revenue evidence; do not invent W4, CAC, LTV, MRR or readiness percentages.
- **Privacy & commercial:** no independent legal/accountant/vendor/store approval inferred from approved product strategy docs.

**Owner decision requested by this PR:** accept this **audit baseline and prioritization proposal**, not implementation, code release, bulk Issue edits or Beta/paid GO. Next issue and PR remain subject to explicit owner direction and separate evidence.
