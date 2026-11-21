# OVRANTO — Business Governance and Operating Model

**Status:** approved in principle by product owner, 2026-11-21.  
**Canonical business epic:** [E22 #550](https://github.com/sauron9521/gym-platform/issues/550).  
**Master project roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

This folder specifies **how the SaaS business is operated**. It is not an implementation, legal advice, role grant, payment authorization or evidence of production readiness.

## 1. Approved business structure

A single business with these **functional responsibilities**, which can be combined by one staff member while the company is small:

| Function                   | Accountability                                                                                   | Critical limit                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Owner / Super Admin        | Final business decisions, financial exceptions, price and campaign publication, staff privileges | Requires privileged session, step-up and audit                                 |
| Administrator / Operations | Daily customer/trainer/operations work, proposals, escalations                                   | Cannot publish pricing/marketing changes                                       |
| Marketing                  | Campaign drafts and performance reports                                                          | Can propose, cannot approve/publish                                            |
| Finance                    | Settlement checks, accounting handoff, refund analysis                                           | No unsupported direct ledger edit or autonomous refund without approved policy |
| Support                    | Cases, assistance, escalation, proposed compensation                                             | No permanent Pro or payment execution by default                               |
| Moderator / Trust & Safety | Trainer/content reviews, complaints and appeals                                                  | No general access to financial/customer secrets                                |
| Analyst                    | Aggregated reporting, business performance                                                       | Read-only, scoped; no default individual PII access                            |
| Technical Operator         | Health, incidents, infrastructure recovery                                                       | Infrastructure access does not confer billing authority                        |

**User identity remains unified.** Athlete, Trainer and staff capabilities coexist; no second auth silo or automatic elevation through `User.role`. These are business responsibilities, not claims that the roles already exist in the schema.

## 2. Non-negotiable decision rights

- Only **Super Admin** may approve, activate, schedule, change or stop a live subscription price or promotional offer. Admin and authorized Marketing can create drafts/submit requests.
- An unapproved request cannot activate at its requested start time. Approvals bind to an immutable revision; editing requires resubmission. See [#539](https://github.com/sauron9521/gym-platform/issues/539) and [#542](https://github.com/sauron9521/gym-platform/issues/542).
- Temporary customer credits, refunds, unlimited grants and staff privilege changes require explicit authority, reason, audit and an appropriate review path; initial conservative default: Super Admin approves financial exceptions and indefinite access.
- **Delegation limits remain undecided.** Proposed examples like a 7-day support credit or currency-denominated refund cap are NOT approved until recorded separately in [#553](https://github.com/sauron9521/gym-platform/issues/553).
- Requests, approvals, execution and provider reconciliation are distinct events. Delivery of an inbox alert does not approve a request.
- No direct editing of provider-verified payment history or retroactive modification of agreed price versions.
- Backend denies operations without verified role/scope; UI only reflects backend-authoritative authorization. Sensitive operations require re-auth/step-up and audit.
- Paid subscriptions, no-card trials, promotions and admin grants must remain distinct sources of entitlements; grants never fabricate revenue.

## 3. Ownership of systems

| Business domain                                                              | Canonical implementation                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Auth, capabilities, privileged sessions and audit                            | E1 [#281](https://github.com/sauron9521/gym-platform/issues/281), E2 [#282](https://github.com/sauron9521/gym-platform/issues/282) |
| Monetization, payments, price changes and paid-campaign approvals            | E21 [#496](https://github.com/sauron9521/gym-platform/issues/496)                                                                  |
| Admin visual and interaction design                                          | [#387](https://github.com/sauron9521/gym-platform/issues/387)                                                                      |
| Business policy, team rights, support processes and operating decision queue | E22 [#550](https://github.com/sauron9521/gym-platform/issues/550)                                                                  |

Avoid duplicate financial payment, approval, notification or customer-identity engines.

## 4. Governance roadmap

| Phase                                | Outcome                                                  | Primary issues                          | Launch gate                                      |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| **G0 — Policy & decisions**          | Approved charter, RACI, approval rules, KPI ownership    | #551, #553                              | Owner signs off unresolved decision list         |
| **G1 — Trusted staff access**        | Scoped memberships and audited staff rights              | #552; existing #288–290, #294–295, #539 | RBAC negative tests, step-up and verified revoke |
| **G2 — Operational workflows**       | Support cases, Finance procedures, Trust/appeals         | #554–556; #511, #529, #311              | Case/financial actions require correct approvers |
| **G3 — Unified business console**    | Role-scoped workspaces, approval/decision inbox          | #557–558; #387, #543, #544, #533–534    | Real data, safe navigation and end-to-end tests  |
| **G4 — Dry runs & launch readiness** | Staff exit, refunds, rejected promos, incident exercises | #559–560; #498, #512                    | Real owner GO/NO-GO, not CI alone                |
| **G5 — Scale (deferred)**            | Marketplace, teams and advanced reporting                | #521–526, #535, policy review           | Only after recurring operational demand          |

G0 and early G1 can progress before payments; future production financial features remain behind legal/merchant approval. Cross-cutting E22 intentionally does **not** hijack M01–M07 or optional M08 milestones.

## 5. Operating cadence and control

- **Daily:** approvals awaiting owner, payment failures/reconciliation exceptions, support/severity escalations and platform incidents.
- **Weekly:** funnel/trial-to-paid, churn, campaign outcomes, support quality and backlog aging.
- **Monthly:** collected cash vs subscription revenue, refunds, expenses, margins, staff access, operational risks and budget.
- **Quarterly (initial recommendation):** review elevated memberships, exceptions, emergency access and governance policy.

Source-of-truth KPI formulas live in [operating-kpis.md](operating-kpis.md) and E21 [#532](https://github.com/sauron9521/gym-platform/issues/532). Do not display invented production metrics.

## 6. Delivery convention

One narrow PR at a time from current `main`; document paths/acceptance/tests on Issues, enforce backend permission checks, run unit/integration/E2E and real Postgres where sensitive state changes, review CI, **owner manually merges**. An approved policy is not a completed feature. Close an issue only with traceable evidence.

Read: [Roles and Permissions](roles-permissions.md) · [Approval policy](approval-policy.md) · [Reporting KPIs](operating-kpis.md).
