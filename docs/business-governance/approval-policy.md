# OVRANTO — Approval, Exception and Escalation Policy

**Policy status:** operating principles owner-approved on 2026-11-21; quantitative thresholds pending separate signoff in [#553](https://github.com/sauron9521/gym-platform/issues/553).  
**Related:** [#542](https://github.com/sauron9521/gym-platform/issues/542), [#543](https://github.com/sauron9521/gym-platform/issues/543), [#511](https://github.com/sauron9521/gym-platform/issues/511), [#529](https://github.com/sauron9521/gym-platform/issues/529).

## 1. Required recorded properties
Every material request has requester, subject scope, type, reason, current/desired state, expected business/customer impact, immutable submitted revision, createdAt, decision deadline, reviewer decision/reason, execution status, provider reconciliation (where applicable) and audit correlation.

A **draft** has no side effects. A **submitted** or **rejected** request never authorizes changes by reaching its proposed start time. An **approved** request authorizes only its exact unchanged revision.

## 2. Suggested state machine
`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | NEEDS_CHANGES`.  
After approval, a domain-specific action may become `SCHEDULED → EXECUTING → EXECUTED → VERIFIED` or `FAILED → RECONCILIATION_REQUIRED`.  
`WITHDRAWN` or `EXPIRED` are terminal according to approved domain policy. Revisions after review start require a **new submission** and review. The canonical workflow per domain belongs to its owning implementation; do not create one generic payment engine.

## 3. Action-specific governance
| Business action | May request | Approver at launch | Executor and proof |
| --- | --- | --- | --- |
| Web list price / discount / 2+1 campaign | Explicitly permitted Admin/Marketing | **Super Admin only** | E21 versioned pricing/promotion workflow; approved version & public checkout evidence |
| Store price/offer | Admin/Marketing proposal | Super Admin internally **and separate store readiness** | App Store Connect / Play Console rule and external publication confirmation |
| Indefinite free Pro grant | Operations / Support proposal | **Super Admin only** | E21 Admin Grants; audit and user entitlement read |
| Temporary compensation grant | Support / Operations | Super Admin until a separately approved short-duration delegation exists | Valid grant, expiry, reason, no fake payment |
| Refund / chargeback exception | Support or Finance | Super Admin until approved thresholds | Provider operation through E21 #511, verified state/reconciliation |
| Staff role/privilege assignment | Operations proposal | **Super Admin only** | E1/E2 secure staff-access flow and step-up |
| Account suspension / trainer review / appeals | Scoped Operations/Moderator | Designated qualified reviewer per approved policy; high severity to Super Admin | Owning Admin/Trust module, evidence and reversible flow |
| Infrastructure incident | Technical Operator | On-call/Owner according to severity | Incident log and postmortem; no billing API privilege implied |

No one may approve their own Marketing submission using a lower-privilege role. For a founder-only team, Super Admin can initiate and approve with explicit fresh step-up and full audit; independent second reviewer is a deferred governance upgrade.

## 4. Review UX and notifications
- Super Admin inbox receives a **durable notification** for SUBMITTED proposals. The notification is merely navigation; its delivery/read status is not consent.
- Approve / reject must show the exact price/currency/interval, eligibility, duration, new vs existing subscriber effects, affected channels, requestor, reason and revocation/release implications.
- All money-affecting actions require explicit user-facing consequences (where relevant), secure API mutation, server confirmation and read-only reconciliation after ambiguous responses.
- On review, notify requester of outcome and reason; do not claim action executed before provider/status confirmation.
- Scheduled worker rechecks immutable approval, effective date and provider/store availability; cannot activate unapproved or edited offer.

## 5. Audit, conflicts and incidents
- Reviewer and executing actor are distinct recorded fields even if, initially, the same founder is eligible to perform both.
- Preserve old values; never rewrite settled payment, priced checkout, or signed provider event.
- Actor/target permission checks, role revocation, idempotency, duplicate submissions, out-of-order provider notifications and lost HTTP responses have negative tests.
- Escalation on missing Super Admin should mean **hold/block**, not auto-approve. Urgent refunds or safety cases may trigger emergency *review* but not bypass legal provider constraints.
- Access to evidence is limited, with retention/redaction policies and separate export authorization.

## 6. Pending quantitative decisions
Record each as an ADR decision before implementation: (a) maximum Support temporary credit, (b) refund execution authorization thresholds and currency equivalence, (c) dual approval above material financial impact, (d) SLA for requests and support, (e) appeal response window, (f) emergency incident authority, (g) campaign budget caps.
