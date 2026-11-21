# OVRANTO — Delegation, Decision Rights and Escalation Register

**Status:** baseline governance rules approved by product owner on 2026-11-21; **individual delegation limits and SLA targets are NOT approved** until separately recorded by the owner.  
**Owner:** Super Admin / business owner. **Change control:** governed via [E22 #553](https://github.com/sauron9521/gym-platform/issues/553).  
**Scope:** business decisions and operational authority, not a deployed role, permission, contract, payment API or legal determination.

This document implements the policy established by [the operating charter](README.md) and [approval principles](approval-policy.md). It **does not** confer an authorization. Server-enforced privileges remain the responsibilities of [E1 #281](https://github.com/sauron9521/gym-platform/issues/281), [E2 #282](https://github.com/sauron9521/gym-platform/issues/282) and [E21 #496](https://github.com/sauron9521/gym-platform/issues/496).

## 1. Status and decision terminology

- **Approved baseline:** principles explicitly agreed by the owner, such as Super Admin-only live pricing and campaign approvals.
- **Default until delegated:** a conservative operating rule, typically requiring Super Admin signoff; this is _not_ evidence that the corresponding API is implemented.
- **Pending owner decision:** a monetary threshold, number of days, timeout/SLA, channel, country or delegated permission not yet selected. Do not infer it from examples.
- **Production-ready:** only after approved decision + backend authorization + automated tests + applicable legal/provider gates + staging rehearsal + explicit release approval.

An employee can hold multiple staff functions (Marketing + Analyst, for example), but cannot obtain more authority by combining roles, reusing product-facing Athlete/Trainer privileges or submitting an action as another principal.

## 2. Separation of duties and action verbs

| Verb               | Meaning                                                     | Constraint                                                           |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Read               | See authorized aggregate or specific scoped records         | Least privilege; PII need-to-know                                    |
| Draft              | Compose a private proposal without effect on live customers | Draft has **zero** external side effects                             |
| Submit             | Make an immutable revision available for review             | Actor/reason/target and version recorded                             |
| Review             | Check evidence, economics, consumer effects and compliance  | Review alone is **not** approval                                     |
| Approve / reject   | Sign a particular proposal revision                         | Only authorized approver; elevated step-up for financial decisions   |
| Schedule / publish | Make an already-approved revision effective                 | Live pricing/promotions: **Super Admin-only authority**              |
| Execute            | Carry out approved operational/provider mutation            | Requires separate action permission, idempotency and verified result |
| Reconcile          | Confirm eventual outcome using provider/source-of-truth     | Never equate button success with settled payment                     |
| Export             | Transfer data outside Admin                                 | Separate, scoped, audited permission and retention rule              |

**Mandatory:** the API checks role, staff assignment, scope, sensitive-session freshness, resource ownership and allowed transition every time. Hiding an Admin button is not sufficient.

## 3. Decision-rights matrix (baseline for launch)

| Operation                                           | Who may propose                               | Who may approve at launch                                               | Who may execute                                                                 | Evidence / owning backlog                                               |
| --------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| List-price change or retirement                     | Authorized Admin / Marketing / Super Admin    | **Super Admin only**                                                    | Super Admin protected publication workflow                                      | Version, reason, old/new prices, affected cohorts; #536/#539/#542       |
| Time-limited discount, coupon, 2+1, prepaid package | Authorized Admin / Marketing / Super Admin    | **Super Admin only**                                                    | Super Admin-authorized promotion engine                                         | Approved offer revision, start/end, channel, redemption; #540/#541/#542 |
| Schedule or stop a public campaign                  | Authorized Admin / Marketing                  | **Super Admin only**                                                    | Super Admin or previously approved scheduler; emergency stop remains controlled | Status, effective time, approved unchanged revision; #542               |
| Web vs Apple/Google commercial offer                | Authorized Admin / Marketing                  | **Super Admin for internal policy**, plus separate store readiness      | Owning provider/store process                                                   | External SKU, store approval/published state; #499/#515/#516            |
| One-off first-month trial policy change             | Product/Marketing/Operations                  | **Super Admin only**                                                    | Verified trial-policy implementation                                            | Eligibility, duration, opt-in and rollback; #527                        |
| Temporary free Pro / support credit                 | Support / Operations / Super Admin            | **Super Admin by default** until explicit narrow delegation             | Separately authorized grant action                                              | Customer case, expiry, reason, grant ID; #529/#554                      |
| Indefinite Pro grant or revocation                  | Operations proposes; Super Admin may initiate | **Super Admin only**                                                    | Super Admin-only grant mutation until revised policy                            | Grant ID, beneficiary, before/after, actor/reason; #529/#530            |
| Refund, dispute or financial exception              | Support / Finance / Operations                | **Super Admin by default**, no monetary delegation active               | Verified provider-authorized executor after approval                            | Case, payment ID, provider outcome, reconciliation; #511/#555           |
| Marketing advertising budget or spend exception     | Marketing / Finance                           | **Super Admin by default**                                              | Designated staff only after approved budget and vendor controls                 | Budget revision, cap, invoice and spend audit; #553                     |
| Staff membership issue/modify/revoke                | Operations may request                        | **Super Admin only**                                                    | Privileged staff-management API                                                 | Verified identity, role delta, scope, expiry, audit; #552/#294          |
| Suspend/reactivate account                          | Operations or Trust with case                 | Policy-qualified security/Operations reviewer; high risk to Super Admin | Existing admin account workflow subject to RBAC                                 | Abuse evidence, reversible state, session revocation; #293/#553         |
| Trainer approval or removal                         | Scoped reviewer / Operations                  | Approved trainer-verification reviewer; conflict escalates              | Trainer review module                                                           | Application and reason, audit, appeal eligibility; #311                 |
| Content/seller moderation                           | Moderator / Operations                        | Designated Trust reviewer; appeal independent where possible            | Owning moderation module                                                        | Case ID, content evidence, appeal decision; #556/#524                   |
| Account export or privacy-sensitive lookup          | Assigned Support/Finance for limited need     | Owner-approved data-access policy; extra approval for bulk export       | Distinct export operation with audit                                            | Purpose, scope, retention; #552/#554                                    |
| Settlement variance or payout discrepancy           | Finance                                       | Finance reviews; material adjustment needs Super Admin                  | Owning reconciliation/provider integration                                      | Provider event, ledger difference, closeout; #511/#555                  |
| Production service incident                         | Technical Operator / on-call                  | Severity-specific incident leader; Owner for business-risk exceptions   | Technical recovery runbook, never billing-price privilege                       | Incident ID, timeline, recovery and retrospective; #560                 |

"May propose" does **not** authorize reading all underlying customer records; evidence supplied with a request must be scoped and redacted. Named roles are business intentions: many are not yet implemented as persisted staff memberships (#552).

## 4. Approval vs execution, state transitions

### 4.1 Pricing/marketing canonical process

`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | NEEDS_CHANGES`

An **approved, unchanged** proposal may become `SCHEDULED → ACTIVE → EXPIRED/STOPPED` through the owning E21 workflow. No other transition enables a public price or coupon. Proposer edits after submission create a new revision and invalidate the old approval. Publication date alone never activates `PENDING` or `REJECTED` proposals.

The Super Admin approval and actual provider/store publication are **separate attestations**: internal "approved" does not assert that Apple/Google has updated a storefront. Notifications (#543) are pointers to a request, not approval actions.

### 4.2 Grant and refund canonical process

`CASE_OPEN → REQUESTED → AUTHORIZED → EXECUTING → CONFIRMED | RECONCILIATION_REQUIRED | FAILED`.

Compensation and paid subscriptions must remain different sources; the grant is not a payment, and revoking an Admin Grant does not revoke a separate paid subscription. For refunds, only a verified provider result can confirm money returned. An ambiguous response triggers **read-only reconciliation**, not blind repeated payment mutation.

### 4.3 No generic second engine

The E21 pricing workflow (#542) owns _its own_ state and audit. Support/refunds (#511/#554) and moderation (#556) retain domain-specific lifecycle. E22's unified Inbox (#557) is a **read-only case/decision aggregation layer**, never a shared bypass for financial actions.

## 5. Escalation and conflicts of interest

- **No Super Admin available:** hold all non-emergency price/financial publication and monetary exceptions; mark `WAITING_APPROVER`, retain request and notify the designated backup only if formally authorized. **No auto-approval or blanket fallback to normal Admin.**
- **Founder-only operation:** the Super Admin may initiate and approve their own valid change with fresh reauthentication and complete audit. Independent four-eyes review becomes a requirement only after a separately approved staffing policy.
- **Multiple hats:** having Marketing and Finance grants simultaneously cannot turn a proposal into an approval unless the actor independently qualifies as Super Admin for that action.
- **Employee exit / privilege revoked:** future reviews and scheduled sensitive mutations must revalidate current authority and be blocked or explicitly reapproved where needed; old tokens do not authorize actions after revocation.
- **Critical safety complaint:** allow rapid case escalation and interim proportionate protective actions only within an authorized safety policy; cannot use a safety incident to forge a refund, payment state or promotion.
- **Emergency technical access:** time-limited, reasoned, observable, independently reviewed afterward; technical infrastructure access never grants an Admin Billing API right.
- **External legal/provider block:** an internal approval never overrides a payment processor, App Store/Play rule, tax/legal prerequisite or cardholder authorization.
- **Appeals:** a staff member should not be the sole final reviewer of their own contested moderation decision when a second authorized reviewer is available; otherwise escalate to Owner.

## 6. Decision register — explicit signoff required before delegation

| ID     | Decision requiring owner signature                          | Default until approved                               | Candidate, **NOT authorized**                                |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| GOV-01 | Max Support compensation validity                           | Super Admin approves each grant                      | Support may issue up to 7 days to eligible account           |
| GOV-02 | Admin temporary grant cap and plan limits                   | Super Admin approves all time-bounded nonpaid access | Admin up to 30 days with case/reason                         |
| GOV-03 | Refund threshold by currency/provider/rolling day           | Super Admin approves each refund                     | Finance refund under fixed low-value cap                     |
| GOV-04 | Finance payout adjustment and settlement variance threshold | No autonomous manual ledger adjustment               | Material amount band + secondary review                      |
| GOV-05 | Marketing campaign budget cap                               | Super Admin approves ad spend and public campaign    | Monthly departmental spend allowance                         |
| GOV-06 | Approval turnaround targets and overdue notifications       | Queued pending; no timed approval                    | 1 business day for standard review                           |
| GOV-07 | Support first response / resolution targets                 | Record times; no contractual SLA promise             | Internal first response within 24h                           |
| GOV-08 | Moderation appeal and critical-abuse review window          | Escalate safety cases; log review                    | Severity-dependent response deadlines                        |
| GOV-09 | Two-person approval for large exceptions                    | Super Admin step-up with full audit                  | Separate approver above material amount                      |
| GOV-10 | Backup approver / break-glass delegation                    | No fallback authority for price or money             | Time-limited emergency designated approver (not for pricing) |
| GOV-11 | Staff access attestation interval                           | Owner reviews as practical; log changes              | Quarterly formal access review                               |
| GOV-12 | Campaign stacking and cross-channel limits                  | No stacking unless explicitly approved               | One promotional code per paid checkout                       |

**No figures in the right column are current system rules.** In particular, 7 days, 30 days, one day and 24 hours are examples only. An approved decision must include its **effective date, end/review date, relevant plan/provider/currency, owner, policy revision and evidence link**, and trigger its own scoped implementation/QA issue. If not approved, no elevated staff permissions are deployed.

### Decision-record template

```yaml
decision_id: GOV-XX
status: PROPOSED # APPROVED | REJECTED | REVOKED | SUPERSEDED
policy_version: 1
requested_by: '<staff identity>'
approved_by: '<authorized Super Admin identity or null>'
decision_at: null
effective_from: null
effective_until: null
scope: '<business domain / channel / currency / customer scope>'
value: '<limit or permission, if approved>'
rationale: '<business and risk justification>'
evidence: '<immutable issue / audit reference>'
implementation_issues: []
risk_owner: '<responsible business function>'
review_due_at: null
```

The template is a **human-readable governance record**, not a runtime config. Changes to live permissions require server validation and release gates.

## 7. Verification matrix — expected allow/deny cases

| Scenario                                                         | Expected outcome                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Marketing submits 20%-off draft                               | **Allowed** only with explicit propose membership; not visible to checkout         |
| 2. Ordinary Admin approves that price through direct HTTP        | **Denied** by backend                                                              |
| 3. Super Admin approves with expired step-up                     | **Denied**; reauthenticate                                                         |
| 4. Super Admin approves unchanged valid revision                 | Approval recorded, publication occurs only after applicable gates                  |
| 5. Marketing edits approved 2+1 bonus duration                   | New revision **must** be reviewed; old approval invalid                            |
| 6. Scheduled start date passes while pending                     | **No activation**                                                                  |
| 7. Promo approval is sent via Inbox notification URL             | Click **cannot approve** without explicit secured mutation                         |
| 8. Authorized staff loses role before publication                | Re-evaluate authority; block unsafe transition or reapproval                       |
| 9. Support requests 7-day credit without delegated GOV-01        | Request allowed with scope; issuing credit **denied**                              |
| 10. Admin tries indefinite grant                                 | **Denied** unless independently Super Admin                                        |
| 11. Revocation of Admin Grant on customer with paid subscription | Grant removed; paid entitlement **preserved**                                      |
| 12. Finance marks refund successful before provider confirms     | **Denied**; pending/reconcile instead                                              |
| 13. Provider refund API response lost after mutation             | No blind retry; query state read-only and reconcile                                |
| 14. Super Admin approves large refund but provider rejects it    | Approval ≠ refund; final status **failed/pending reconciliation**                  |
| 15. Analyst attempts to export all customer PII                  | **Denied** without separate explicit scoped authority                              |
| 16. Technical Operator attempts pricing API with service access  | **Denied**                                                                         |
| 17. Employee removed, old session submits pending grant          | **Denied**; server privilege invalidated/rechecked                                 |
| 18. Two reviewers act concurrently on same revision              | Exactly one authoritative state transition, second sees current state              |
| 19. Moderator tries to close appeal against own decision         | Escalate to independent reviewer / Owner per policy                                |
| 20. Store offer approved internally but SKU unavailable          | Web or native activation constrained to verified channel; no false published state |

Acceptance tests for implementation should include permission matrix × account scope × state version, duplicate/reordered requests, replay, concurrent review, expired authentication and audit completeness. **This docs-only issue verifies policy consistency, not those runtime behaviors.**

## 8. Operational accountability and measurement

- **Daily:** unanswered Super Admin requests, aged support cases, payment reconciliation exceptions, critical reports.
- **Weekly:** time-to-approval, rejections and changed proposals, compensation reasons, refunds/payout variances, SLA candidate baseline.
- **Monthly:** provider-verified refunds and payments, marketing discount effectiveness, grants not counted as revenue, role changes and policy review.
- **Quarterly proposal:** elevated staff access recertification and break-glass review, subject to GOV-11 signoff.

Use [operating KPI policy](operating-kpis.md) and E21 [#532](https://github.com/sauron9521/gym-platform/issues/532) for monetary definitions. "No records" is not equal to "0 revenue" when financial instrumentation does not yet exist.

## 9. Implementation mapping and explicit non-goals

| Capability                                             | Existing issue(s)                      |
| ------------------------------------------------------ | -------------------------------------- |
| Trusted principal, staff scope, admin session, step-up | #288–290, #294–295, #552               |
| Super Admin pricing-only permission                    | #536, #539                             |
| Immutable price/promotion approval and scheduling      | #542, #541, #544                       |
| Durable financial approval Inbox                       | #543, cross-team read aggregation #557 |
| Temporary/indefinite admin grants                      | #529–530                               |
| Refund execution and reconciliation                    | #511, operational playbook #555        |
| Support cases and scoped requests                      | #554                                   |
| Trust, trainer review and appeals                      | #311, #556                             |
| Role-scoped UI and analytics                           | #387, #558, #532–534                   |
| Production legal/payment gates                         | #498, #512                             |

**Out of scope for #553:** new Prisma tables, API endpoints, screen changes, actual money handling, legal signoff, MFA implementation or delegation of new privileges. The policy is versioned and must be signed off before downstream operators receive actionable permissions.
