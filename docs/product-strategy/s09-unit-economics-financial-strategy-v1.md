# OVRANTO — S09 Unit Economics & Financial Strategy v1.0

**Статус рішення: OWNER APPROVED — затверджено власником 2026-11-22.**  
**Напрям:** S09 — Unit Economics & Financial Strategy.  
**Підстава:** 25/25 стратегічних відповідей, S09 v0.1 OWNER REVIEW і явна команда «затверджую».  
**Затверджені залежності:** [S01](s01-product-strategy-v1.md), [S02](s02-customer-experience-v1.md), [S03](s03-privacy-data-ownership-v1.md), [S04](s04-legal-compliance-v1.md), [S05](s05-security-trust-v1.md), [S06](s06-production-reliability-v1.md), [S07](s07-product-analytics-experiments-v1.md), [S08](s08-go-to-market-v1.md).  
**Roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Technical Roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа рішення:** затверджується стратегічна **економічна політика**, не конкретні ціни, квоти, бізнес-оператор, податки, merchant/provider чи право на фактичні платежі. Фінансові припущення не перетворюються на реальні KPI без evidence. S09 публікується у **docs-only PR**, RECORDED — лише після ручного merge власником і перевірки у main. S04 Legal L1/L2/L3, S05 Security та S06 Reliability gates залишаються незалежно **NO-GO до evidence і окремого owner GO**. Implementation backlog не змінюється до завершення S01–S12; **S10 NOT_STARTED**.

## 1. Strategic Objective

OVRANTO використовує підхід **Evidence-Based Unit Economics + Sustainable Growth + Financial Governance**.

Мета — стійкий SaaS-продукт, що може фінансувати інфраструктуру, обслуговування, критичну безпеку, підтримку та розвиток. Розділяти verified revenue, cash receipts, gross/contribution margin, profit, forecasts і економічну вартість часу засновника. Аналізувати Trainer та Athlete окремо; не масштабуватися без фактичної потреби та допустимих економічних показників. Не скорочувати critical S05/S06 вимоги задля короткострокового покращення margin.

## 2. Revenue Model

**Рішення 01A.** Перший майбутній commercial MVP:

| Продукт          | Фінансова роль                                 |
| ---------------- | ---------------------------------------------- |
| **Trainer paid** | Основне стратегічне джерело майбутнього доходу |
| **Athlete Pro**  | Додаткове стратегічне джерело доходу           |
| **Athlete Free** | Базовий безкоштовний продукт; не paid revenue  |

Trainer-first — пріоритет, а не гарантована частка у реальних платежах.

Не включати як гарантовані MVP revenues clubs/B2B, marketplace commissions, AI, advertisement, продаж програм або майбутні партнерські винагороди. Вони відкладені до окремих рішень.

## 3. Pricing Strategy

**Рішення 02A.** Початкові ціни обґрунтовувати за фактичною cost structure, дослідженою willingness to pay, порівнюваними конкурентними орієнтирами та сценарною маржинальністю.

**Точні ціни не затверджені**; вони належать [Pricing & Packaging #497](https://github.com/sauron9521/gym-platform/issues/497). Відповідь на Beta-інтерв'ю про готовність платити — гіпотеза, не paid conversion.

Публічна ціна повинна мати approved product scope, currency, billing interval, effective period/version, tax wording, renewal/cancellation/refund terms, відповідні approvals. Не копіювати конкурентні ціни і не приймати довільну націнку як достатнє обґрунтування.

## 4. Trainer Paid Quota

**Рішення 03A.** Trainer paid обмежується **кількістю активних спортсменів**, а не historical invitations, total created workouts чи всіма користувачами, запрошеними колись.

В #497/#502 уточнити active Trainer–Athlete relationship, quota slot start/release, pending invites, termination, revocation, grace, downgrade/upgrade, overage та поведінку збережених програм.

**Конкретна числова quota не затверджена.** Квота не дозволяє видалення даних Athlete чи обхід S01/S03 прав на власну історію.

## 5. Athlete Free & Pro Boundary

**Рішення 04A.** Athlete Free зберігає виконання trainer-assigned workouts, фактичні сети й basic workout log, базову історію/прогрес, feedback тренера та незалежний basic tracker за S01.

Athlete Pro — додаткові персональні інструменти й розширена аналітика; точний feature set — майбутній окремий signoff.

Basic coached workflow не може стати Athlete Pro paywall. Витрати на Free Athlete враховуються окремо. Припущення, що Trainer paid їх фінансує, потрібно перевірити на фактичній економіці.

## 6. Billing Periods & Currency

**Рішення 05A.** Для першого українського commercial MVP **розглядати місячну підписку в гривні** як стартову гіпотезу, але це не затверджена публічна ціна/валюта контракту чи платіж.

Yearly, prepaid, бонусні періоди, мультивалютність — пізніше, після окремого рішення та перевірок Billing/merchant/legal. Не починати recurring charge без належного user choice, payment mandate та S04 gates.

## 7. Cost Structure

**Рішення 06A+B+C+D.** У фінансовій моделі:

### 7.1. Infrastructure

API/hosting, PostgreSQL, backups/PITR/recovery, storage/media, monitoring/observability, domains/TLS, email/push та реально використовувані сервіси.

### 7.2. Transactional

Merchant/provider/store commissions за застосовністю, chargeback/refund processing costs, FX/settlement fees. Refund principal і невідшкодовані provider fees — окремо, без подвійного віднімання.

### 7.3. Operating

Marketing, support, legal/accounting, software/operations tooling, фактичні development costs, contractors при залученні.

### 7.4. Owner Time

Праця засновника має окрему **economic valuation** за documented rate/method; **не прирівнювати** її автоматично до сплаченої зарплати, податку чи cash outflow. Для аналітики — cash-only та owner-time-adjusted views.

## 8. Cost Allocation & Unit Cost

**Рішення 07A.** Вимірювати fixed/variable/shared expenses і драйвери: active Trainer/Athlete, Trainer–Athlete relationships, confirmed workouts, API/database load, storage, notification volume.

Не розподіляти всю собівартість лише на registered users. Встановити versioned allocation rules, уникати shared-cost double counting. До baseline оцінки показувати як estimates, не фактичні unit costs.

## 9. Infrastructure Cost Governance

**Рішення 08A.** **Baseline → Monitor → Optimize → Scale.** Встановлювати cost alerts, бюджетні межі й capacity assumptions за реальними даними. Enterprise-scale архітектура без потреби не обов'язкова.

Неприпустимо скорочувати backup, security, S06 RPO/RTO, workout data integrity або recovery заради маржі. Якщо hard gates неможливо фінансувати, launch залишається NO-GO.

## 10. Profitability & Margins

**Рішення 09A.** Розрізняти:

- **Gross Margin:** revenue мінус визначена пряма собівартість надання послуг відносно revenue.
- **Contribution Margin:** revenue мінус explicitly included variable/service/acquisition costs у конкретній метриці.
- **Operating Result:** результат після відповідних operating expenses за обраним accounting method.
- **Cash Flow:** реальний рух коштів.
- **Owner-Time Adjusted Result:** управлінський сценарій із оцінкою роботи засновника.

Для кожної метрики documented inclusion/exclusion rules, reporting period, denominator та as-of. «Отримали гроші мінус VPS» — не визначення повного profit.

## 11. Customer Acquisition Cost

**Рішення 10A.** **CAC = eligible confirmed acquisition costs / new confirmed paying customers** за явно визначеним cohort/period/attribution window.

Показувати **Cash-only CAC** і окремий **Fully loaded (з owner time)**, не включати умовну вартість праці у cash-only. Leads, registrations, installs, Beta users, trials, promos та admin grants не є paying customers.

Без достатньої фактичної витратної бази або підтверджених платних клієнтів — **Not available**, не fabricated value чи автоматичний нуль.

## 12. Lifetime Value

**Рішення 11A.** Розділяти observed cohort revenue, observed cohort contribution, історичну customer lifetime evidence і прогнозний LTV.

Projected LTV завжди **Scenario/Estimate** з версією припущень та horizon. Не представляти короткий W4 5–10 free Beta тренерів як доказ довгострокового платного LTV/churn. Спрощений ARPU/churn розрахунок допустимий тільки при задокументованих і виконаних модельних припущеннях.

## 13. Marketing Channel Economics

**Рішення 12A+B+C+D.** Збирати lawful мінімальну channel attribution, verified campaign spend, owner time окремо, funnels lead → activation → confirmed paid conversion (коли є фактичні оплати) → retention/contribution.

Дотримуватися S03/S07 data minimization: без прихованого fingerprinting і detailed Beta demographics. Малі cohorts аналізувати counts/qualitative evidence, а не вигадувати ROI з CTR.

## 14. Trainer & Athlete Economics

**Рішення 13A.** Окремі Trainer та Athlete paid cohorts, unique paying accounts, ARPU/ARPPU, paid churn, product retention, usage cost, contribution й trial-to-paid.

Вивчати залежність **Trainer → invited Athletes → workouts → usage cost → possible paid revenue**, але не припускати причинність і не double-count одну людину через декілька ролей чи paid+grant entitlement.

**Product W4 / inactivity не дорівнює subscription churn.**

## 15. Monthly Financial Planning

**Рішення 14A.** Місячний Owner cycle: approved budget caps, actual paid expenses, variance, future commitments, available cash, forecasts, risks та регулярний перегляд.

До Beta потрібно фінансувати legal/privacy/security/backups та інші критичні prerequisites. Значні відхилення запускають окремий review. Не базувати зобов'язання на прогнозній, ще не підтвердженій виручці.

## 16. Reserve & Runway

**Рішення 15A.** Резерв залежить від реальних critical expenses, cash availability та ризиків після baseline: інфраструктура, security/backup, підтримка, юридичні/бухгалтерські зобов'язання, провайдери, settlement delays, refunds.

**Не затверджувати довільно 3 або 6 місяців резерву.** Runway моделювати з available cash і cash burn; при нульовому/від'ємному burn або недостатніх даних не виводити некоректний термін.

## 17. Financial Scenarios

**Рішення 16A.** Три версійні сценарії:

| Сценарій     | Припущення                                                       |
| ------------ | ---------------------------------------------------------------- |
| Conservative | Повільніша paid acquisition/conversion, вищі витрати             |
| Base         | Центральна обґрунтована робоча модель                            |
| Growth       | Швидше зростання й відповідні вищі variable/infrastructure costs |

Inputs: paying Trainer/Athlete, price, conversion, churn, taxes/provider fees, operating/infrastructure/marketing. Outputs: revenue, cash flow, margins, break-even та runway. Усі assumptions мають source/date/version; **scenario ≠ financial fact**.

## 18. Break-even

**Рішення 17A.** Три погляди: **Accounting break-even** за допустимим recognition method, **Cash break-even** за inflows/outflows, **Owner-time-adjusted break-even** як окремий management view.

Враховувати Trainer/Athlete paid mix, quotas, usage, fees, refunds, fixed/variable costs. Не називати break-even перевищення рахунку за VPS або досягнення кількості зареєстрованих користувачів. Цифрового target поки немає.

## 19. Billing Source of Truth

**Рішення 18A.** Єдиний authoritative фінансовий source — **Billing ledger і provider-confirmed payment/refund/settlement facts**, а не checkout success screen, marketing click або optimistic UI.

Окремо відображати paying subscriptions, paid entitlements, no-card trials, provider trials, promo grants, admin grants, refunds/chargebacks/disputes.

**Trial/promo/admin grants не є paid revenue чи paying customers**. Не створювати другий Billing engine, synthetic revenue чи duplicate data warehouse.

## 20. Prepaid & Revenue Recognition

**Рішення 19A.** Для prepaid окремо зберігати confirmed paid amount, actual cash settled, transaction fees, paid service period, bonus duration, offer/price version та applicable accounting recognition schedule.

**2+1 не означає три оплати**. Повна prepaid-сума за 6/12 місяців не може автоматично стати MRR одного місяця. Визнання доходів, податки й deferred revenue залежать від реально обраного юридичного/бухгалтерського методу та пер-flow review S04/#498.

## 21. Refunds, Chargebacks & Reconciliation

**Рішення 20A.** Refund — provider-confirmed state, не натискання кнопки Admin. Disputes/chargebacks мають окремий lifecycle. Settlement зіставляти з ledger, а розбіжності та missing webhooks — явно позначати й ескалювати.

Corrections — контрольовані audit records, **не тихе редагування provider-signed history**. Capability-scoped operations, owner approvals і audit. Реалізаційний ownership [#555](https://github.com/sauron9521/gym-platform/issues/555), [#512](https://github.com/sauron9521/gym-platform/issues/512).

## 22. Owner Financial Dashboard

**Рішення 21A+B+C+D.** Чотири логічні блоки:

- **Revenue:** verified paid accounts, gross/net revenue з визначеною формулою, MRR/ARR, refunds, cash receipts, currencies, as-of.
- **Economics:** observed trial→paid, paid cohorts/churn, Trainer/Athlete contribution, CAC/LTV за достатніх real data.
- **Costs & Health:** infrastructure/operating expenses, fees, margins, cash burn, runway, budget variance.
- **Quality & Governance:** data freshness, reconciliation status, incomplete records, KPI versions, role-based access та audit.

Коли факту немає, показувати **Not available / Incomplete / Insufficient data**, а не підміняти 0 чи прогнозом. Free Beta не створює фактичного paid revenue.

## 23. Scaling Investments

**Рішення 22A.** Реінвестувати у marketing/infrastructure лише за доказаної потреби, прийнятної unit economics, фінансування critical security/reliability та adequate cash reserve.

Не витрачати автоматично всі receipts, не масштабуватися за registration count. Кожен investment change має owner budget approval, expected value і stop criteria.

## 24. Solo-Owner & Team Growth

**Рішення 23A.** Спочатку **solo-owner**, який може поєднувати product, engineering, operations, marketing, support та finance coordination.

Найм і делегування — за виміряною операційною потребою й витратами. Ролі отримують scoped access без blanket financial/customer access; Owner/Super Admin зберігає critical pricing/refund/promo approvals, step-up й audit. Додаткового обов'язкового production approver без нового рішення немає.

## 25. International Unit Economics

**Рішення 24A.** Перед виходом у країну аналізувати demand/willingness to pay, currency, taxes, merchant/provider/store fees, local marketing, support/localization, infrastructure/data residency й очікувану contribution margin.

Не переносити автоматично українські ціни/маржу. Врахувати S08 regional approval, S04 правові/комерційні gates та окремий owner GO.

## 26. Financial Governance & Backlog Sequencing

**Рішення 25A.** Owner затверджує budget, commercial policy, pricing/campaign publication та critical financial exceptions. Versioned proposals, Super Admin step-up, audit і provider-confirmed facts залишаються обов'язковими.

**Після явного approval S09 — лише один docs-only PR.** Немає implementation Issue/DB/CI/production pricing змін. Не створювати дубльованих Billing/Finance epics; один comprehensive evidence-based backlog audit **після S01–S12**, тоді small implementation slices.

## 27. Financial Roadmap

| Фаза                           | Мета                                          | Gate                                                     |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------- |
| **F0 Closed Beta**             | Витрати й usage, 0 платного revenue від Beta  | Безкоштовна Beta 5–10 тренерів, S04 L1/S05/S06, owner GO |
| **F1 Pre-commercial Planning** | Pricing та unit-cost models                   | #497, merchant/legal/accounting evidence                 |
| **F2 Paid MVP**                | Verified transactions й paying unit economics | Billing ledger, S04 L2/L3/store, owner GO                |
| **F3 Optimization**            | Real CAC/LTV, contribution та runway          | Actual paid cohorts, controlled budget                   |
| **F4 Scale/International**     | Стійкі реінвестиції та нові ринки             | S08 country gates + owner approval                       |

F0 Beta без карток, paywalls, real charges або subscriptions. Жодна фаза не вмикається автоматично за часом або кількістю accounts.

## 28. Compatibility With S01–S08

| Стратегія | Незмінні вимоги                                             |
| --------- | ----------------------------------------------------------- |
| S01       | One Trainer paid, one Athlete Pro, Athlete Free, free Beta  |
| S02       | Basic workout UX не обмежується довільним paywall           |
| S03       | Purpose-bound privacy/finance/marketing access              |
| S04       | Merchant, taxes, receipts, refunds, L1/L2/L3 & stores       |
| S05       | Privileged operations, step-up, audit                       |
| S06       | Backup/recovery/data integrity не знижуються через економію |
| S07       | Server-authoritative domain/Billing facts та versioned KPI  |
| S08       | Founder-led growth, budget caps, regional/launch owner GO   |

**Змістових конфліктів із S01–S08 немає.** Це не означає, що code, payments або legal gates реалізовані.

## 29. Existing GitHub Ownership

| Issue                                                         | Призначення               |
| ------------------------------------------------------------- | ------------------------- |
| [#496](https://github.com/sauron9521/gym-platform/issues/496) | Monetization & Billing    |
| [#497](https://github.com/sauron9521/gym-platform/issues/497) | Pricing & Packaging       |
| [#498](https://github.com/sauron9521/gym-platform/issues/498) | Merchant, Tax & Legal     |
| [#500](https://github.com/sauron9521/gym-platform/issues/500) | Billing schema            |
| [#502](https://github.com/sauron9521/gym-platform/issues/502) | Entitlements              |
| [#512](https://github.com/sauron9521/gym-platform/issues/512) | Web Commercial GO         |
| [#527](https://github.com/sauron9521/gym-platform/issues/527) | Future no-card trial      |
| [#532](https://github.com/sauron9521/gym-platform/issues/532) | Billing Metric Dictionary |
| [#533](https://github.com/sauron9521/gym-platform/issues/533) | Billing Analytics API     |
| [#534](https://github.com/sauron9521/gym-platform/issues/534) | Admin Billing Analytics   |
| [#535](https://github.com/sauron9521/gym-platform/issues/535) | Paid cohorts and growth   |
| [#550](https://github.com/sauron9521/gym-platform/issues/550) | Business Governance       |
| [#555](https://github.com/sauron9521/gym-platform/issues/555) | Finance Operations        |
| [#560](https://github.com/sauron9521/gym-platform/issues/560) | Go-live operations        |
| [#588](https://github.com/sauron9521/gym-platform/issues/588) | Strategic Roadmap         |
| [#353](https://github.com/sauron9521/gym-platform/issues/353) | Technical Roadmap         |

Не створювати окремий financial source of truth/dashboard/payment engine без dedupe й підтвердженої потреби.

## 30. Risk Register

| Ризик                                 | Рівень   | Контроль                             |
| ------------------------------------- | -------- | ------------------------------------ |
| Synthetic revenue з trial/grants      | Critical | Provider/Billing-confirmed facts     |
| Змішування cash, MRR та prepaid       | High     | Versioned KPI dictionary             |
| Неправомірні merchant/tax/payments    | Critical | S04 gates та accountant/legal review |
| Недооцінка Athlete Free               | High     | Usage-based costing                  |
| Double-count shared costs             | High     | Documented allocation                |
| Ненадійні CAC/LTV без historical data | High     | Observed vs scenario                 |
| Unreconciled refunds/chargebacks      | High     | Provider reconciliation              |
| Manual rewriting ledger history       | Critical | Immutable evidence/correction        |
| Marketing/infrastructure overspend    | High     | Budget caps/variance                 |
| Reliability/security cost cutting     | Critical | S05/S06 hard gates                   |
| Недостатній reserve/runway            | High     | Actual critical cost baseline        |
| Unapproved prices/promotions          | High     | Owner step-up/approval               |
| Premature paid scaling                | High     | Contribution/cash gates              |
| International mispricing              | High     | Country-specific scenarios           |

Потенційні ризики **не свідчать про реальні фінансові порушення**.

## 31. Remaining Decisions & Technical Details

**Pricing (#497):** Trainer paid / Athlete Pro числові ціни, active-client quota, можливий Trainer Free, Athlete Pro features, final billing terms/currency/taxes, grace/overage/upgrades.

**Cost baseline:** measured Trainer/Athlete costs, shared allocation, owner-time method, budget caps, reserve requirement, initial cash/financing sources, reinvestment thresholds.

**Metrics/Finance (#532–535, #555):** KPI definitions/cutoffs, CAC window, LTV horizon, margin inclusions, prepaid/refund accounting, provider/merchant/tax policies, reconciliation cadence/escalation, Dashboard RBAC/currency/data quality.

**Scaling:** hiring triggers, prepaid/yearly economics, country-specific launch costs.

Не перетворювати історичні pricing hypotheses на approved launch prices й не вигадувати значення для невизначених параметрів.

## 32. Owner Approval, Publication & Change Control

Власник явно затвердив S09 Unit Economics & Financial Strategy 2026-11-22 після всіх 25 відповідей і повної S09 v0.1 OWNER REVIEW. Канонічна **v1.0** зберігає прийняту політику без нових сум, quotas, merchant або фінансових зобов'язань.

1. Один **docs-only PR** із S09 v1.0 та docs indexes, CI/format/diff review.
2. **Owner** вручну переглядає й зливає PR; assistant не merge.
3. Лише після owner merge і перевірки канонічного S09 у main — Roadmap #588 статус **APPROVED + RECORDED**.
4. Ніяких implementation Issue/PR/schema/payment changes. Backlog audit після S01–S12.
5. **S10 NOT_STARTED** до окремої команди власника.
6. Зміни політики — versioned revision, impact review S01–S08, explicit owner approval.

**S01–S08 APPROVED + RECORDED; S09 OWNER APPROVED / publication pending owner merge; S10–S12 NOT_STARTED. Незалежні S04/S05/S06 launch gates залишаються NO-GO до реальних evidence та owner GO.**
