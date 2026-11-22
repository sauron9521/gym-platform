# OVRANTO — S12 B2B, Clubs & Marketplace Strategy v1.0

**Status: OWNER APPROVED / RECORDING PENDING manual owner merge.**  
**Date:** 2026-11-22. **Basis:** owner explicitly approved the complete S12 v0.1 OWNER REVIEW following 25/25 questionnaire responses (no additional requests).  
**Dependencies:** S01–S11 APPROVED + RECORDED. **Strategy:** [#588](https://github.com/sauron9521/gym-platform/issues/588). **Technical roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Approval boundary.** This is **strategy only**: no implementation authorization, Club Billing or Marketplace payments, seller payouts, new roles/data flows, deployment or production/Beta/store GO. S12 becomes **RECORDED** only after owner-manual merge of one docs-only PR and verification of this document in main. Independent S04 legal, S05 security, S06 reliability, S09 economics, seller/IP/payment/store gates and explicit owner GO remain applicable. **Post-S12 implementation backlog audit is NOT STARTED and requires a new separate owner command.** Existing E21/E22 implementation ownership is unchanged.

## 1. Strategic Objective

OVRANTO's strategic order: **Independent Trainer SaaS → Small Club collaboration → Evidence-based Organization Billing → Curated Marketplace → Regulated Marketplace Commerce**.

Protect Trainer-first, free initial Athlete workflows, individual identity and data ownership; introduce organizational membership and controlled sharing only when justified. Club role, resource ownership, billing entitlement and marketplace purchase license are separate concerns. Never treat a successful user-facing checkout redirect as payment evidence, nor gross merchandise value as platform revenue.

## 2. B2B & Marketplace Development Order

**Рішення 01A.** **Independent Trainer SaaS → невеликі Clubs → Organization Billing → Marketplace** лише після попиту й окремих gates.

B0 core service; B1 organization data/access foundation; B2 small-club pilot; B3 organizational subscription; M1 moderated catalog/licensing; M2 lawful checkout/commission/payout. Sequence is not a launch calendar or authorization. Club use does not require marketplace features.

## 3. Initial B2B Customer Segment

**Рішення 02A.** Початковий ICP — **невеликі фітнес-клуби та студії з кількома незалежними Trainer**. Discovery має підтвердити попит на membership, scoped roster, organization-level collaboration and possible future payer consolidation.

Не вводити enterprise CRM, payroll, global multi-site ERP або corporate integrations без реального попиту. Тренер залишається незалежним користувачем OVRANTO, навіть якщо співпрацює з клубом.

## 4. Geographic Market Strategy

**Рішення 03A.** **Україна першою**, кожна наступна країна тільки через separate legal/tax/payment/store/privacy/consumer review і explicit owner GO.

Переклад UA/EN або доступність вебсайту не є дозволом на international commercial launch. Seller/payout corridors, contractual merchant model, податки, refunds, data transfers, store purchase policies and support capacity слід перевіряти country-by-country.

## 5. B2B Pilot Entry Requirements

**Рішення 04A.** Потрібні stable Trainer/Athlete core, інтерв'ю з клубами, **validated demand**, privacy/security readiness і explicit owner GO. Reliability/S04 legal criteria застосовуються до реальних data flows.

Початкова Beta S01/S08 залишається **повністю безкоштовною, чотири тижні, 5–10 Trainer, no cards/subscriptions/automatic charges**. Club Pilot — майбутній окремий етап; його cohort size, duration і success criteria ще не встановлено.

## 6. Organization Identity Architecture

**Рішення 05A.** **Єдина User identity + окремі Organization, Membership, scoped roles/capabilities.** Club не створює новий identity silo й не володіє персональним User account.

Organization, Membership, ResourceOwnership, BillingAccount і OrgEntitlement — **логічні доменні поняття**, а не approved Prisma schema або дозвіл на migration. Server-side auth відокремлює platform Admin/Super Admin, Trainer, Athlete та organization membership.

## 7. Multiple Organization Memberships

**Рішення 06A.** Trainer може мати membership **у кількох клубах**, з явним active organization context і суворою **tenant isolation**.

Кожна операція перевіряє поточного User, organization scope, актуальний membership/capability, target-resource ownership, Athlete-specific permissions. UI context/JWT cache самі по собі не дають доступу. Tests: Club A → Club B IDOR, stale cached permissions, background jobs, cross-tenant exports, offline resume/recovery, tenant switch.

## 8. Organization Roles & Capabilities

**Рішення 07A.** Майбутні scoped ролі: **Club Owner, Club Manager, Club Billing Admin, Club Trainer**. Вони не дорівнюють global platform Admin. Реальні capabilities завжди перевіряє сервер.

Owner: дозволені налаштування та членства; Manager: scoped roster/операції; Billing Admin: organization finance у відповідних межах; Club Trainer: власні/дозволені Trainer–Athlete relationships. Ніхто не отримує з ролі club права публікувати глобальні ціни, змінювати platform staff, читати всі Athlete histories чи обходити E22 Super Admin approvals. UI ролей може вводитися поетапно.

## 9. Club Data Ownership & Privacy

**Рішення 08A+B+C+D.**

- **A:** Athlete контролює власну історію; Club Owner/Manager не бачать всі приватні результати за замовчуванням.
- **B:** особисті та клубні ресурси мають явне ownership/provenance і distinct permissions.
- **C:** приватні Trainer programs/templates не переходять до Club автоматично; shared content має оформлені IP/license terms.
- **D:** roster, aggregated metrics, exports та будь-який cross-tenant access підлягають current server scope, legal purpose і privacy checks.

Organization membership не відкриває S10 Health data. Приватний completed workout лишається під S03; договори та IP належать S04.

## 10. Trainer Departure & Membership Revocation

**Рішення 09A.** Персональний User залишається, club-scoped grants припиняються, ownership програми визначається provenance/IP, а client transfer — окремою правомірною процедурою з audit.

Не призначати чужих Athlete новому Trainer автоматично. Припинення Club membership не стирає підтверджені Athlete workouts, не змінює самостійні платні підписки й не відновлює доступ через cache/queue/backup. Окремо регулювати archive, read/export, retention, support cases та disputed content.

## 11. Initial Club Product Scope

**Рішення 10A+B+C.**

- **A:** Organization profile, member invitation/acceptance/revocation, membership status.
- **B:** minimal scoped Club Owner/Manager/Trainer rights без global Admin.
- **C:** minimal roster й допустимі агреговані звіти лише з privacy-scoped даних.

Не включати в перший Pilot повноцінний CRM, payroll, multi-branch/ERP, automated club access to private templates або складну shared program library. Shared materials після IP/authorization review.

## 12. Organization Seats & Quotas

**Рішення 11A.** Гіпотеза seat metric — **активні Trainer memberships**. Точні billed-seat criteria, quotas, role overlap, pending invitations, concurrency/overage, grace, seat prices та seat release визначити лише після Pilot і S09 evidence.

Не списувати кошти за історичне membership або будь-який pending invite без затвердженого contract. Athlete Free core не стає платним клубним seat автоматично.

## 13. Organization Billing Ownership

**Рішення 12A.** **Organization — окремий billing owner**, organization entitlements дають тільки scoped membership grants і не перепризначають автоматично особисті Trainer/Athlete subscriptions.

Reuse існуючого E21 billing lifecycle/verified events [#496](https://github.com/sauron9521/gym-platform/issues/496), [#500](https://github.com/sauron9521/gym-platform/issues/500), [#502](https://github.com/sauron9521/gym-platform/issues/502), [#525](https://github.com/sauron9521/gym-platform/issues/525). Один billing engine, distinct subscription payer vs membership resource access. No payment or entitlement proof from frontend success redirect.

## 14. Organization Subscription Expiry & Cancellation

**Рішення 13A.** Після належного grace/notice завершуються **лише club-only права**. Особисті User accounts, законно доступна історія Athlete та незалежні paid entitlements не зникають.

Розділяти cancellation, payment failure, grace, membership exit, organization closure, personal deletion/export та disputed IP resources. Exact grace/renewal/proration/archive/read-only access — unresolved implementation/legal terms, не approval на видалення історії.

## 15. Marketplace Initial Product

**Рішення 14A.** Перший Marketplace — **обмежений модераційний каталог дозволених published program versions із ліцензійним контрактом**. Paid checkout, commissions та payouts — окремі подальші gates.

Listing має verified seller, дозволені metadata, published version і visibility/moderation policy. Ніяких private drafts, Trainer client records, confidential Exercise copies або unauthorized IP. Каталог без оплати також має пройти IP/privacy/moderation review.

## 16. Marketplace Program Licensing

**Рішення 15A.** Buyer отримує **ліцензію на конкретну дозволену published version**, без private drafts, чужих Trainer clients чи автоматичних оновлень.

Purchased license **не є** Athlete Pro, Trainer paid, Trainer assignment або organization membership. Term/usage/copy/export/revocation права, discontinued listing, disputed IP and refund consequences потребують перевіреної license policy. Нова версія seller не переписує куплену version.

## 17. Seller Onboarding Policy

**Рішення 16B.** Спочатку **вручну відібрані й перевірені продавці**; self-service seller onboarding відкладено.

Manual curation включає content/IP rights, seller terms, moderation та відповідні legal identity checks. Перед реальними payouts додатково потрібні provider/legal KYC/KYB, current payout eligibility. Manual listing approval **не дорівнює** праву продавати або отримувати кошти; не зберігати зайві identity documents.

## 18. Marketplace IP, Moderation & Buyer Protection

**Рішення 17A+B+C+D.**

- **A:** підтвердження seller IP/license права, reporting порушень.
- **B:** scoped listing moderation, complaints, documented decisions, appeals.
- **C:** versioned buyer rights, обмеження на непомітні зміни/відкликання уже купленої license; delisting не завжди означає втрату законного purchase entitlement.
- **D:** consumer/provider/legal-approved refunds/disputes та захист buyer.

Existing S04 IP/complaint flows та E22 moderation/support governance застосовуються незалежно від фінансової моделі.

## 19. Marketplace Legal Funds Flow

**Рішення 18A.** **Seller/Merchant/Reseller of Record не визначати** до окремої [#521 legal/accountant/provider review](https://github.com/sauron9521/gym-platform/issues/521) та explicit owner approval.

Потрібні seller/buyer contracts, lawful funds routing and ownership, processor availability, tax/consumer obligations, returns/chargebacks, payout responsibilities і compliance evidence. **No self-operated unlicensed wallet, ad-hoc seller money collection або manual transfers** як обхід узгодженої моделі.

## 20. Marketplace Commission Policy

**Рішення 19A.** **Не затверджувати commission percentage зараз.** Історичні 10–15% в #521 — лише гіпотеза до перевірки costs/provider/legal/demand та реальної S09 contribution margin.

GMV, gross seller receipts, recognized platform commission, payouts payable, provider fees, refunds/chargebacks і profit показувати **окремо**. GMV ≠ platform revenue ≠ profit.

## 21. Payments, KYC/KYB & Payout Controls

**Рішення 20A+B+C+D.**

- **A:** схвалений provider із доведеною можливістю settlement/payouts; без внутрішнього незаконного wallet.
- **B:** seller KYC/KYB, current provider-verified payout eligibility і мінімізація документів.
- **C:** verified signed webhooks, idempotent purchase/license grants, immutable commission/reconciliation evidence, refund/reversal accounting.
- **D:** server-side finance capabilities, step-up, audit, payout-account change protection та delegated approvals лише в межах E22.

Клієнтський redirect не є payment proof. Duplicate, lost response, replay і out-of-order events повинні оброблятися без подвійних licenses, charges, commissions або payouts; необхідні safe read-only reconciliations.

## 22. Refunds, Chargebacks & Store Compliance

**Рішення 21A.** Refund/dispute workflow — **lawful/provider-approved**, а purchase license змінюється на основі верифікованих подій та дозволеної policy. Розділяти refund request, approval, provider payout/refund execution, settled outcome, chargeback і seller liability.

Окремий **App Store / Google Play gate** для цифрових продажів: product/channel classification, відповідні правила, purchase/restore/refund proof, native device QA. Web Commercial GO ≠ mobile digital purchase GO.

## 23. B2B & Marketplace Security Invariants

**Рішення 22A+B+C+D.**

- **A:** tenant isolation, current membership and resource authorization, BOLA/IDOR negative tests.
- **B:** Athlete ownership, revocation, history protection при зміні Trainer/Club/seller.
- **C:** immutable provider/billing evidence, idempotency, audit, safe ambiguous/lost-response reconciliation.
- **D:** Super Admin governance, scoped staff rights, independent commercial/finance approvals per E22 [#550](https://github.com/sauron9521/gym-platform/issues/550).

Жодна club membership/price/checkout event не дає blanket доступ до приватних workouts чи platform administrative permissions.

## 24. B2B & Marketplace Metrics

**Рішення 23A+B+C+D.**

- **A:** active orgs, active Trainer seats, utilization and cohort retention.
- **B:** verified organization revenue, contribution margin, onboarding/support costs.
- **C:** published listings, verified purchases, license activation and buyer feedback.
- **D:** GMV, accounting-recognized commission, provider fees, refunds, chargebacks and seller payouts **окремо**.

Metrics dictionary має визначити authoritative data sources, reporting period, cohort/active definitions, currency/tax and rounding. Не змішувати paid orgs із free pilots/admin grants; не рахувати Marketplace purchase як S07 server-confirmed completed workout/W4.

## 25. Release Gates

**Рішення 24A+B+C+D.**

- **A — Legal/Tax/Consumer/IP:** country/product contracts, funds flow, seller rights, store rules.
- **B — Security/Privacy:** tenant/RBAC, consent, privacy, moderation/anti-abuse evidence.
- **C — Provider/Reliability:** sandbox payments, refunds/disputes, signed webhooks, reconciliation, store-specific native tests, restore/lost-response safety.
- **D — Economics/Operations:** unit economics, support/incident readiness, rollout/rollback, explicit owner GO.

Club Pilot, Club Billing, Marketplace Catalog, Checkout, Payouts та mobile sales мають **окремі релевантні gates**; green CI, published docs чи готові DB tables не підтверджують legal, financial або production GO.

## 26. Strategy & Backlog Governance

**Рішення 25A.** Після окремого owner approval S12 v0.1 → v1.0 **один docs-only PR**, checks, **manual owner merge**, verification у main, Roadmap #588 → APPROVED + RECORDED.

Лише після завершення S01–S12 **за окремою новою командою** — evidence-based audit/dedup/reprioritization of implementation backlog, перевірка actual main/PR/issues/acceptance; створювати тільки підтверджені відсутні implementation Issues. **Автоматично починати аудит або Club/Marketplace реалізацію після затвердження S12 заборонено.**

## 27. Phased B2B & Marketplace Roadmap

| Phase                              | Product scope                                   | Required gate                            |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| **B0 Independent Trainer SaaS**    | Core Trainer/Athlete flows, free Beta           | S01–S09 applicable evidence              |
| **B1 Organization Foundation**     | Membership, tenant scope, capabilities          | Demand, design, S03/S05                  |
| **B2 Controlled Small Club Pilot** | Invitations, revocations, scoped roster/reports | Real interviews, security, owner GO      |
| **B3 Organization Billing**        | Payer, seat grants, subscriptions               | E21/S04/S05/S06/S09 + owner GO           |
| **M1 Curated Marketplace**         | Verified sellers, published catalog, licenses   | IP/privacy/moderation/release review     |
| **M2 Regulated Commerce**          | Checkout, commission ledger, payouts/refunds    | #521 provider/legal/tax/store + owner GO |

Не створювати автоматичних запусків або dates; кожний product phase залишається deferred до фактичних release approvals.

## 28. Architecture & Domain Boundaries

**NestJS modular monolith + PostgreSQL/Prisma + existing Auth/Workout/Program/Billing domains**, майбутні Organization і Marketplace modules за validated need. No duplicate User login, Billing system, financial ledger або TrainingProgram logic.

| Domain            | Authority                                            |
| ----------------- | ---------------------------------------------------- |
| User/Auth         | Identity, server-side current capabilities           |
| Organization      | Membership, organization context, lifecycle          |
| Trainer–Athlete   | Permissions, relationship, assignment                |
| Programs/Workouts | Published version and actual completed-workout truth |
| Billing E21       | Subscriptions, entitlements, signed provider status  |
| Marketplace       | Seller/listings, buyer versioned licenses            |
| Finance           | Commission, settlement and payout reconciliation     |
| Governance E22    | Staff permissions, approval, appeals, audit          |

Точні tables, API paths, event/DTOs, migrations та authorization matrix залишаються implementation design, **не** схвалені через S12.

## 29. Compatibility With S01–S11

| Strategy | Preserved invariant                                                                   |
| -------- | ------------------------------------------------------------------------------------- |
| S01      | Trainer-first, Athlete Free core; future one Trainer paid and one Athlete Pro         |
| S02      | Core coaching/Workout UX незалежні від Clubs/Marketplace                              |
| S03      | Athlete data ownership, scoped access, revocation, export/deletion                    |
| S04      | Ukraine-first, IP/consumer/contracts, independent store/legal gates                   |
| S05      | Server authority, least privilege, BOLA/IDOR, sensitive audit                         |
| S06      | Data integrity, idempotency, fail-safe recovery, releases                             |
| S07      | W4 лише verified workouts; B2B/Marketplace metrics separately                         |
| S08      | Free no-card 4-week initial Beta, truthful claims                                     |
| S09      | Verified revenue vs GMV/grants; cost and margin evidence                              |
| S10      | Health integrations optional; club roles do not imply Health access                   |
| S11      | AI readiness NO model calls, AI integration deferred; no automatic club-data transfer |

Матеріальних суперечностей з погодженою S01–S11 політикою на стратегічному рівні не виявлено; це **не** підтвердження, що gates реалізовані.

## 30. Existing GitHub Ownership

| Issue                                                                                                                        | Ownership                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [#496](https://github.com/sauron9521/gym-platform/issues/496)                                                                | E21 Billing / Monetization          |
| [#497](https://github.com/sauron9521/gym-platform/issues/497)                                                                | Pricing / Packaging                 |
| [#498](https://github.com/sauron9521/gym-platform/issues/498)                                                                | Merchant / Tax / Legal              |
| [#500](https://github.com/sauron9521/gym-platform/issues/500), [#502](https://github.com/sauron9521/gym-platform/issues/502) | Billing models / entitlements       |
| [#521](https://github.com/sauron9521/gym-platform/issues/521)                                                                | Marketplace legal money flow        |
| [#522](https://github.com/sauron9521/gym-platform/issues/522)                                                                | Listings and program licensing      |
| [#523](https://github.com/sauron9521/gym-platform/issues/523)                                                                | Checkout/commission/refunds         |
| [#524](https://github.com/sauron9521/gym-platform/issues/524)                                                                | Seller onboarding/payout/moderation |
| [#525](https://github.com/sauron9521/gym-platform/issues/525), [#526](https://github.com/sauron9521/gym-platform/issues/526) | Organization billing/seats/UX       |
| [#550](https://github.com/sauron9521/gym-platform/issues/550), [#560](https://github.com/sauron9521/gym-platform/issues/560) | Business Governance / Go-Live       |
| [#588](https://github.com/sauron9521/gym-platform/issues/588), [#353](https://github.com/sauron9521/gym-platform/issues/353) | Strategy / Technical roadmaps       |

**Можливі post-S12 gaps тільки для перевірки:** membership/multi-org lifecycle, resource provenance, Trainer departure/transfer, Club Pilot UX, scoped reporting, versioned seller licenses, moderation, analytics. Не відкривати duplicate issues до evidence-based audit.

## 31. Risk Register

| Potential risk                               | Severity      | Required control                                        |
| -------------------------------------------- | ------------- | ------------------------------------------------------- |
| Cross-tenant Athlete/Club leaks              | Critical      | Current server membership/resource auth and negatives   |
| Club Owner blanket access to Athlete history | Critical      | S03 purpose and sharing scope                           |
| Unauthorized client transfer                 | Critical      | Athlete/Trainer rights and audited authorization        |
| Automatic Trainer IP appropriation           | High          | Provenance and licensed materials                       |
| Loss of data after club billing expiry       | Critical      | Separate data lifecycle and entitlements                |
| Seat/entitlement race and duplicates         | High          | Concurrency and database tests                          |
| Private draft exposed as listing             | Critical      | Immutable published-version access                      |
| Seller selling others' IP                    | High/Critical | Seller content review/appeals                           |
| Unlawful movement of seller funds            | Critical      | #521 legal/provider approvals                           |
| Unauthorized/duplicate payout                | Critical      | Provider eligibility, step-up, immutable reconciliation |
| Wrong refund/commission balance              | High/Critical | Idempotent ledger/refunds                               |
| Mobile digital purchase rule breach          | High/Critical | Independent store gate                                  |
| GMV counted as platform revenue              | High          | S09 metric/accounting dictionary                        |
| Unproven B2B demand                          | High          | Interviews and narrow pilot                             |
| Solo-owner operating overload                | High          | Controlled scope and operations gates                   |

Це ризики для планування, **не підтверджені інциденти**.

## 32. Remaining Decisions, Owner Approval & Change Control

**Стратегічні 25/25 рішення explicitly owner approved 2026-11-22**, але числові/implementation параметри **не затверджені**.

**B2B:** точний Pilot cohort/duration і exit criteria; tenant membership permissions; seat definition/quotas/prices; grace/proration; client transfer and Club IP contracts; reporting privacy; organization archive/export lifecycle.

**Marketplace:** seller cohort size/criteria; listing and license duration/use; removal/appeals; seller/merchant/reseller legal structure; payment provider and store routes; commission percentage; refund/chargeback allocations; payout frequency/reserves.

**Operations:** financial approval thresholds; fraud/abuse metrics; support SLA; country-specific taxes; deployment/rollout evidence; observed provider/support economics; change-control policy.

**Порядок публікації:**

1. Власник окремо затвердив повний S12 v0.1 після questionnaire 25/25, без змін — ця v1.0 зберігає політику без довільних business/legal чисел.
2. **Один docs-only PR** з S12 v1.0 і strategy indexes; formatting/CI, review; **тільки owner manual merge**, assistant не зливає.
3. **RECORDED** тільки після фактичного owner merge й перевірки canonical strategy у main та Roadmap #588.
4. **Не розпочинати implementation backlog audit автоматично** — нова окрема команда власника після S12 main verification; лише після audit створювати відсутні Issues.
5. Club Billing, paid Marketplace, seller payouts, cross-tenant data processing залишаються **NO-GO** до окремих legal/privacy/security/finance/store evidence й owner approval.

**S01–S11 APPROVED + RECORDED; S12 OWNER APPROVED / RECORDING PENDING.** Усі 12 стратегічних напрямів мають явне owner approval, але статус **S01–S12 APPROVED + RECORDED** можливий тільки після manual merge цього PR і main verification. **Implementation backlog audit NOT STARTED.**
