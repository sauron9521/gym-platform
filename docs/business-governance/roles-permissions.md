# OVRANTO — Staff Roles, Permissions and RACI

**Status:** baseline governance approved 2026-11-21; technical authorization and delegated thresholds remain pending.  
**Related:** [E22 #550](https://github.com/sauron9521/gym-platform/issues/550), [#552](https://github.com/sauron9521/gym-platform/issues/552), [#553](https://github.com/sauron9521/gym-platform/issues/553), E1 [#288](https://github.com/sauron9521/gym-platform/issues/288).

## 1. Role vs capability vs resource scope

- **Customer role/capability:** Athlete, Trainer and ordinary product entitlements, independent of staff.
- **Staff membership:** trusted, explicitly issued, revocable business-function assignment tied to the same User identity, possibly multiple memberships.
- **Permission:** explicit action such as `billing.price.propose`, `billing.price.approve`, `support.case.read`, `finance.refund.request`, `staff.membership.manage`. Actual API namespace conventions are decided with existing RBAC.
- **Scope:** own assigned case, managed organization, business domain or Owner-only sensitive data; permission without valid scope never authorizes an object.
- **Authenticated action:** evaluated by backend on every request, not by a badge, an old JWT role or UI hiding a button.

Current code has `ADMIN` role and a restricted Super Admin operator allowlist, **not a persisted implementation of all these future staff jobs**. See E1 #281/#288–290, E2 #294 and billing #539. Do not permit public/self-service marketing or admin role grants.

## 2. Actions matrix

| Action | Owner / Super Admin | Operations Admin | Marketing | Finance | Support | Moderator | Analyst | Tech |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View approved prices | Yes | Yes | Yes | Yes | Selected | No | Aggregated | No |
| Propose price/promotion | Yes | Yes | Yes | Optional explicit | No | No | No | No |
| Approve/publish/stop prices & promotions | **Only** | No | No | No | No | No | No | No |
| Create/modify staff access | **Only** | Request only | No | No | No | No | No | No |
| Read scoped support cases | Yes | Yes | No | Billing-related only | Assigned cases | Assigned moderation cases | Aggregate | No |
| Request temporary compensation | Yes | Yes | No | Optional | Yes, draft/request only | No | No | No |
| Approve permanent Pro access | **Only** | No | No | No | No | No | No | No |
| Request refund | Yes | Yes | No | Yes | Yes | No | No | No |
| Approve financial exceptions/refunds (launch default) | **Only** | No | No | Proposal/review only | No | No | No | No |
| Execute provider refund | Only if technical/provider authorization and approval | No | No | Conditional, separately approved | No | No | No | No |
| Handle moderation/appeal | Final oversight | Escalate | No | No | Intake only | Review scoped | No | No |
| View aggregate analytics | All | Operational | Marketing only | Financial only | Support KPIs | Trust KPIs | Approved metrics | Health KPIs |
| Execute infrastructure recovery | Oversight | No | No | No | No | No | No | Technical scope only |

**Yes** means governance *intent*, not an already deployed permission. Selected/Optional/Conditional require a scope or a later documented authorization. **Never infer monetary thresholds from this matrix.** All finance execution must follow separate verified processor rules.

## 3. Mandatory segregation and approval
1. Explicitly distinguish `view`, `propose`, `review`, `approve`, `execute`, `reconcile`, `export` for each business domain.
2. A proposal cannot approve itself from Admin or Marketing permissions; a valid Super Admin uses a fresh step-up and immutable revision.
3. Finance/accounting checks are separate from changing payment outcome; Support resolves cases, does not directly mutate payment ledger.
4. Only designated staff may see scoped PII, and every export/data change is audited.
5. Conflicting duties, temporary elevated grants, staff leave and emergency access have explicit restrictions and review.

## 4. Joiner / mover / leaver (pending #552)
- **Joiner:** trusted invitation, identity validation, explicit Super Admin approved membership, scoped permissions, expiry/review date, audit.
- **Mover:** re-evaluate and remove old access *before* granting new responsibilities; reauthenticate for sensitive operations and record approval.
- **Leaver:** disable membership, revoke/recheck sessions immediately, stop pending scheduled privileged actions if necessary, retain immutable activity records.
- **Periodic review:** by an authorized reviewer (recommended quarterly until revised), recertify elevated and inactive grants.
- **Break-glass:** separate time-limited emergency procedure, reason, notification, retrospective review; do not use shared root credentials.

## 5. Verification scenarios
- An Athlete+Trainer+Marketing identity may propose an offer, but cannot approve it.
- A regular Admin's crafted HTTP approval request is denied even when UI buttons are hidden.
- Finance can see scoped refunds but cannot view unrelated workout details.
- Support sees a case but cannot activate a paid subscription or refund payment.
- Ex-employee with old session/access token cannot continue a privileged API action.
- Tech Operator with service access cannot publish promotions by calling the business API.
- All deny-by-default tests include revoked membership, expired step-up and cross-tenant IDs.

## 6. Deferred decisions
Exact delegated support compensation period, financial approval thresholds, whether 4-eyes is mandatory for Owner-created proposals, staff appointment process, incident staffing/on-call coverage. Until explicitly approved, use conservative Super Admin signoff.
