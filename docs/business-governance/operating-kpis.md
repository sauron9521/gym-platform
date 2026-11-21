# OVRANTO — Business KPI and Reporting Governance

**Status:** executive reporting definitions for planning, not a populated dashboard.  
**Billing source of truth:** [#532](https://github.com/sauron9521/gym-platform/issues/532); implementation [#533–534](https://github.com/sauron9521/gym-platform/issues/533).

## 1. Owner overview
Show only **verified data** with report `asOf`, period, timezone and currency. Never fabricate KPI cards from design mockups. If no trusted source exists, show `not available yet`, not an invented zero.

| Category | Metric | Interpretation/source |
| --- | --- | --- |
| Paid subscriptions | Active, provider-verified paying subscription count | Excludes trial, marketing and free Admin Grants |
| Active Pro access | Unique customers with a currently valid paid/trial/promo/manual entitlement | Deduplicate overlapping sources |
| Trial | New starts, active, expired, trial→paid conversion | Eligibility and measured cohort window must be defined |
| Cash | Verified captured amounts, refunds, net collected cash | Separate from invoiced/authorized intent and recurring revenues |
| Recurring revenue | MRR and ARR | Versioned contracted recurring prices; explicit annual treatment, currency and refunds |
| Prepaid passes | One-off cash collected, effective access periods and bonus duration | A 2+1 purchase is one paid charge, **not** three fictitious monthly charges |
| Churn/retention | Cancel, involuntary churn, active paid cohort | Defined denominator and measurement time |
| Finance risk | Failed payments, chargebacks, unsettled settlement variance | Provider source and reconciliation status |
| Growth | Campaign spend, attributed paid conversion, redemption and CAC if inputs exist | Do not infer acquisition cost without cost data |
| Operations | Open/aged support, escalated refund/grant/appeal requests, time-to-decision | Case evidence and SLA flags, not arbitrary UI state |
| Security | Privilege changes, pending access review, break-glass/denied sensitive actions | Security audit, not publicly visible analytics |

## 2. Reporting cadence
- **Daily owner console:** pending critical approvals, unusual refunds/failed payments, incident severity and today's verified cash.
- **Weekly functional review:** paid growth, trial conversion, cancelations, campaign effectiveness, support quality and blocked cases.
- **Monthly business review:** revenues and provider fees, refunds/chargebacks, verified operating expenses, cash/settlement reconciliation, customer retention, budget and risk actions.
- **Quarterly privileges:** elevated staff access review and exceptions / incident learning.

## 3. Controls
- Reports expose only approved aggregates per staff role and require purpose-bound permission for customer-level drilldowns. Marketer sees campaign data, Finance sees monetary settlement, Support sees operational case metrics, Analyst gets restricted read-only views.
- Old price versions, promotions and Admin Grants are preserved as auditable sources; don't count them as new paid revenue.
- Multi-currency amounts require currency-specific breakdown until an approved FX normalization method exists.
- Delayed/out-of-order provider events must not silently change a previously published historical report without recorded re-computation/quality signal.
- Data exports require explicit authorized permission and audit; retention/privacy rules apply.

## 4. Deferred metrics
Cohort expansion, LTV/CAC, marketplace margin, club seat efficiency and predictive forecasting are **G5 / #535** until real, consented and reliable source data supports them.
