# OVRANTO — S08 Go-to-Market Strategy v1.0

**Статус рішення: OWNER APPROVED — затверджено власником 2026-11-22 без змін.**  
**Напрям:** S08 — Go-to-Market.  
**Підстава:** 25/25 структурованих стратегічних відповідей, S08 v0.1 та v1.0 OWNER REVIEW, явна команда власника «Затверджую» після фінальної редакції.  
**Затверджені залежності:** [S01](s01-product-strategy-v1.md), [S02](s02-customer-experience-v1.md), [S03](s03-privacy-data-ownership-v1.md), [S04](s04-legal-compliance-v1.md), [S05](s05-security-trust-v1.md), [S06](s06-production-reliability-v1.md), [S07](s07-product-analytics-experiments-v1.md) — APPROVED + RECORDED.  
**Стратегічний roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа рішення:** S08 затверджує **Go-to-Market policy**, а не фактичну готовність Beta, продажів, публічної кампанії або міжнародного запуску. Документ пропонується у **docs-only PR для ручного merge власником**; **RECORDED** настає лише після перевірки в `main`. Незалежні S04 Legal (L1/L2/L3), S05 Security, S06 Reliability, privacy та інші застосовні gates залишаються **NO-GO без фактичних evidence й owner GO**. Реалізаційні Issues не змінюються до комплексного аудиту після S01–S12; **S09 NOT_STARTED**.

## 1. Strategic Direction

OVRANTO використовує **Founder-Led + Trainer-First + Product-Led Growth**. Мета — залучити незалежних тренерів, дати їм організувати фактичні тренування спортсменів, підтвердити продуктовий ефект і лише після цього керовано розширюватися.

Пріоритет: доказана цінність і якість використання замість кількості реєстрацій. Першими перевіряються onboarding, activation, retention, якісний feedback та надійність бізнесових сценаріїв. Не запускати одночасно дорогі кампанії, платні підписки, партнерську мережу чи багато нових країн без окремих рішень.

## 2. Target Audience

**Рішення 01A.** Перший сегмент — **незалежні персональні тренери із силових тренувань та бодибілдингу**, що працюють онлайн/офлайн.

Основний комерційний покупець — Trainer. Головна аудиторія Athlete — його клієнти; незалежним Athlete залишається доступним базовий tracker згідно S01.

Проблеми сегмента: розрізнені інструменти для програм, призначень, фактичних результатів, прогресу, trainer review та feedback. Club/enterprise/B2B або масове Athlete-first залучення не стають стартовою стратегією.

## 3. Value Proposition

**Рішення 02A.** **OVRANTO об'єднує створення тренувальних програм, їх виконання та контроль підтвердженого прогресу в одному процесі для тренера і спортсмена.**

Робоче повідомлення: **«Створюй програми. Тренуйся. Відстежуй реальний прогрес».** Це робочий marketing copy, не нове окремо затверджене final brand slogan.

Показувати готові, перевірені можливості: Trainer program workflow, призначення, фактичне виконання, history/progress і feedback. Не заявляти «найкращий», «гарантовані результати», «безвідмовний offline», масовий AI чи недоведені конкурентні переваги.

## 4. Acquisition Model

**Рішення 03A.** Головний шлях: **Trainer acquisition → Trainer activation → Athlete invitations → Athlete activation → confirmed workouts → voluntary retention / referrals**.

Тренер запрошує спортсменів через погоджені безпечні зв'язки. Independent Athlete зберігає власний шлях. Invite не передає trainer необмежених прав на приватні результати; діють S03/S05 consent/permissions.

## 5. Geography & Localization

**Рішення 04A.** **Україна першою**, основні мови продукту й маркетингу **UA/EN**. Наявність EN перекладу або доступність сайту з іншої країни не означає її дозволений marketing/commercial launch. Нові ринки — лише після попиту, юридичної, платіжної, магазинної, продуктової та support перевірок і окремого owner GO.

## 6. Initial Acquisition Channels

**Рішення 05A+B+C+E.**

| Канал                                               | Призначення                                   | Етап             |
| --------------------------------------------------- | --------------------------------------------- | ---------------- |
| Особисті контакти й прямі звернення                 | Перші Trainer candidates та інтерв'ю          | Pre-Beta         |
| Instagram / TikTok                                  | Реальні короткі product demonstrations        | Pre-Beta / Beta  |
| Добровільні рекомендації й professional communities | Органічне Trainer acquisition                 | Beta / Expansion |
| Landing / waitlist                                  | Пояснити продукт і зібрати qualified interest | Pre-Beta         |

Партнерства з фітнес-залами не є обов'язковим каналом початкової хвилі; можливі пізніше після окремої перевірки.

Direct outreach: правила платформ і закон, без mass spam, прихованих contact databases чи припущення, що публічний профіль означає згоду на маркетингове повідомлення.

## 7. Content Strategy

**Рішення 06A+B+C+D.** Чотири формати:

1. Короткі відео **Trainer → Athlete workflow**: створення, призначення, запис фактичного workout та перегляд прогресу.
2. Покрокові інструкції та приклади використання.
3. Матеріали про реальні проблеми trainer/athlete: таблиці, розрізнені повідомлення, відсутність достовірних результатів.
4. **Справжні інтерв'ю та кейси** лише з належним дозволом, перевіркою точності й мінімізацією персональних даних.

Не показувати як вирішені ті проблеми, для яких відповідна можливість ще недоступна або не пройшла QA.

## 8. Organic Referrals

**Рішення 07A.** Спочатку **добровільні рекомендації без винагород**. Trainer може рекомендувати іншому тренеру; Athlete може самостійно розповідати про продукт.

Paid bonuses, free Pro months, entitlement grants, contests та incentive referral mechanics **відкладені**; вони потребують окремої економіки, eligibility, anti-fraud, privacy та комерційного approval. Trainer invite для клієнта не означає promotional referral campaign.

## 9. Paid Acquisition

**Рішення 08A.** Платна реклама — після перевірки onboarding, activation, базових conversion funnels, retention/інтерв'ю та відсутності критичних проблем product data integrity.

Перші тести — **невеликі й контрольовані**. Для кампанії визначити purpose, audience, channel, budget cap, duration, metrics, stop criteria та owner approval. Не вважати impressions/clicks підтвердженням product-market fit і не масштабувати трафік у неробочий funnel.

## 10. Closed Beta Recruitment

**Рішення 09A.** Керований власником набір **5–10 тренерів** через особисті контакти, waitlist та добровільні рекомендації. Процес: interest → перевірка ICP/eligibility → правдиве пояснення Beta → applicable GO evidence → invitation → onboarding → actual usage.

**Waitlist sign-up та реальне запрошення учасника в Beta — різні операції.** Waitlist потребує власної правової підстави й privacy controls; реальні Beta invitations заборонені до фактичного проходження застосовних S04/S05/S06 gates.

## 11. Beta Eligibility

**Рішення 10A+B+C+D.** Trainer-кандидат повинен:

- Мати реальних Athlete, готових добровільно тестувати.
- Відповідати силовому/суміжному тренерському сегменту.
- Мати готовність користуватися продуктом і повідомляти про проблеми.
- Відповідати чинним **age/privacy/legal requirements**.

Популярність у соцмережах не є критерієм. S04 тимчасово передбачає **adult-only Beta**; пропорційна перевірка віку та її evidence — за погодженими legal requirements, не вимагати document scans за замовчуванням без обґрунтованої необхідності.

Athlete участь добровільна, з належними terms/privacy/role-scoped permissions.

## 12. Beta Athlete Cohort

**Рішення 11A.** Практичний орієнтир — **2–3 реальні добровільні Athlete на одного тренера за можливості**, **без жорсткої квоти**. Trainer із одним готовим Athlete не відхиляється автоматично.

Мета — перевірити реальні assignments, confirmed workouts, trainer review/feedback та progress, не стимулюючи набір неготових учасників заради формального KPI.

## 13. Beta Onboarding & Support

**Рішення 12A.** Founder-assisted onboarding: особисте знайомство тренера із workflow, короткі інструкції, Athlete invitation, форма повідомлення про помилку, доступний support contact та добровільні інтерв'ю.

Не запроваджувати обов'язкові щоденні/тижневі анкети або недоведені обіцянки 24/7 support. Privacy/security звернення обробляються за S03–S06 та бізнесовими процедурами.

## 14. Beta Observation Windows

**Рішення 13A.** Кожен активований учасник має **повне індивідуальне чотиритижневе вікно**. Trainer W4 та Athlete W4 визначені S01/S07, значуща активність у **дні 22–28**; включати лише **завершені** W4 cohorts.

Зберігати окремі дати завершення recruitment, індивідуальних observation windows і фінального Beta analysis. Пізній вступ не означає churn, коли вікно ще не завершено. Показувати numerator, denominator та as-of кожного KPI.

## 15. Landing CTA

**Рішення 14A.** До готовності Beta CTA — **«Подати заявку на участь у Beta»** або **«Приєднатися до списку очікування»** із правдивим availability state.

Не ставити «Купити зараз», «Завантажити» для недоступного build, штучні countdown/дефіцит місць чи «перший Pro-місяць» до дозволеного trial. Waitlist з мінімальними контактами, правовою підставою, notice, retention і можливістю належної відмови від optional marketing.

## 16. Landing Information Architecture

**Рішення 15A.** Публічний Landing:

1. **Trainer-first hero**, цільова користь.
2. Trainer → Athlete workflow demo.
3. Основні можливості Trainer.
4. Окремий зрозумілий Athlete path.
5. Підтверджені product screenshots / scenarios.
6. Чесна доступність Beta.
7. Waitlist CTA, FAQ, support.
8. Privacy/legal information.

Не рекламувати Native Trainer Mobile, AI, marketplace або інші deferred фічі як запущені.

## 17. Marketing Evidence & Brand

**Рішення 16A.** Тільки фактичні product capabilities, реальні скриншоти, належно ліцензовані матеріали й справжні testimonials із відповідними дозволами.

Не вигадувати reviews, ratings, customer counts, success/fitness transformations, revenue чи порівняння з конкурентами. OVRANTO brand і visual concept не означають автоматично legal/IP clearance для всіх assets; застосовується [#393](https://github.com/sauron9521/gym-platform/issues/393) та [#388](https://github.com/sauron9521/gym-platform/issues/388).

## 18. Localization, SEO & Availability

**Рішення 17A.** UA/EN з якісними редакціями, SEO/i18n, доступністю, responsive UX, правдивими назвами продуктів.

Посилання лише на **реально доступні** application routes. Production domains/DNS/TLS/sender identities не вважати активними до фактичного володіння/налаштування. EN Landing не є міжнародним market GO.

## 19. Beta Exit Criteria

**Рішення 18A+B+C+D.**

- **Product:** Trainer W4 ≥50% і Athlete W4 ≥50% **окремо**; достовірні повні cohorts, activation/funnels, якісні interviews та причини відтоку.
- **Core journeys:** реальні Trainer assignments, Athlete workouts, data integrity, offline sync, native QA й доступ до даних.
- **Independent gates:** S04 Legal (L1), S05 Security, S06 Reliability, applicable privacy/age/support requirements.
- **Decision:** явне documented owner GO для переходу/розширення.

Чотири тижні самі по собі **не** дозволяють ширший запуск. Якщо W4 не досягнуто, потрібен аналіз причин та окреме owner decision, а не оголошення product fit.

## 20. Controlled Expansion

Після Beta — тільки **обмежене** розширення за окремим owner GO, з метою перевірити повторюваність acquisition, onboarding, activation, retention та природних referrals.

Визначати темп набору, supporting capacity, stop/pause criteria. Не відкривати масову реєстрацію автоматично. Controlled Expansion не дорівнює Commercial Launch.

## 21. Commercial Transition

**Рішення 19A.** Пояснювати майбутню модель: **один Trainer paid**, **один Athlete Pro**, базовий **Athlete Free** за S01.

Ціни, квоти, renewal/refund/payment contracts залишаються у Billing #497 та commercial policy. **Жодної автоматичної конвертації Beta у paid, ретроактивних списань, оплати без явного вибору/мандата чи позбавлення доступу до власної історії.**

Потрібні окремі S04 L2/L3, Billing, merchant/store та owner approvals. Наявність commercial marketing plan не доводить платіжної готовності.

## 22. Future No-Card Trial

**Рішення 20A.** Майбутній **перший місяць Pro без картки** — окремо погоджувана кампанія, **вимкнена за замовчуванням**, не частина Beta.

Потрібні eligibility/duration/expiry/reuse semantics, єдині Billing entitlements, заборона auto-charge без законного payment mandate і відповідного інформування. Existing owner issue [#527](https://github.com/sauron9521/gym-platform/issues/527); promotional codes/offers мають суміжних власників [#528](https://github.com/sauron9521/gym-platform/issues/528) та [#541](https://github.com/sauron9521/gym-platform/issues/541).

## 23. Promotional & Pricing Authority

**Рішення 21A.** Тільки **Owner/Super Admin** остаточно схвалює public pricing, promotion publication/stop і критичні фінансові винятки в межах [Business Governance #550](https://github.com/sauron9521/gym-platform/issues/550).

Marketer/Admin готують drafts/proposals без unilateral publish. Server-side permissions, fresh step-up, immutable audit, versioned approved proposal та schedule тільки для схваленої незмінної версії. **Solo-owner** може виконувати всі ролі, але без обходу захисних перевірок.

## 24. International Expansion

**Рішення 22A.** Після української Beta обирати наступні країни за реальним попитом, відповідністю ICP, конкуренцією, localizations, legal/privacy/merchant/store readiness, support capacity та costs. Немає автоматично затвердженої другої країни.

## 25. Country Launch Gates

**Рішення 23A+B+C+D.**

- **Legal/operator/privacy:** належні права, Terms/Notice, data processing/transfers, local consumer/age obligations.
- **Commercial (за наявності продажів):** merchant, currency, taxes, refunds, Apple/Google requirements.
- **Product/support:** якісний переклад, фактична доступність workflow, підтримка.
- **Security/reliability:** access controls, device checks, backup/recovery, observability й здатність забезпечити обслуговування.

Новий market launch — окреме документоване owner GO, не наслідок перемикання мови.

## 26. Marketing Budget Governance

**Рішення 24A.** Для кожної paid campaign: cap, purpose, audience, channel, duration, success criteria, stop conditions, owner approval.

Враховувати advertising spend **і власний час**. Числові budget caps S08 не встановлює без окремого рішення. Не створювати вигадані CAC/LTV без підтверджених витрат, конверсій і відповідної економічної моделі.

## 27. GTM Measurement

Використовувати S07: **Lead → Beta application → approved Trainer → Trainer Activated → Athlete invitations → Athlete Activated → W4**.

Дивитися qualified leads, application/approval conversion, actual Trainer/Athlete activation, time-to-first-value, role-separated W4, channel performance, verified expenses. Мінімізувати channel attribution; no unauthorized tracking, detailed Beta demographics або fingerprinting.

**Small Beta:** descriptive counts й інтерв'ю, не statistically proven marketing causality. Billing revenue не виводиться з clicks або provisional trial interest.

## 28. Phased Go-to-Market

| Фаза                        | Мета                                                | Умова переходу                                                |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| **P0 Pre-Beta**             | Product, Landing, recruitment preparation           | Privacy controls та applicable Beta GO до фактичних запрошень |
| **P1 Closed Beta**          | 5–10 Trainer + реальні Athlete, free 4-week cohorts | S04 L1, S05/S06 gates, owner GO та повні observation windows  |
| **P2 Controlled Expansion** | Перевірка повторюваності workflows/acquisition      | Реальне Beta evidence, окреме owner GO                        |
| **P3 Commercial Launch**    | One Trainer paid + one Athlete Pro                  | Billing/merchant/legal/store readiness, owner GO              |
| **P4 International**        | Нові поетапно обрані країни                         | Country-specific legal/product/support gates, owner GO        |

Немає автоматичних календарних дат. P2 не відкриває публічну реєстрацію всім. P3 не починається через завершення P1.

## 29. Compatibility With S01–S07

- **S01:** Trainer-first, Україна, UA/EN, 5–10 тренерів/4 тижні free Beta, Athlete Free і два W4 ≥50% — без змін.
- **S02:** чесний onboarding, добровільний feedback, без автоматичних inactivity win-back повідомлень.
- **S03:** lead/referral marketing не обходить privacy rights, scoped coach access або deletion.
- **S04:** до Beta invitations потрібен Legal L1; платний Web/Mobile — окремі L2/L3; Terms, Privacy Notice, optional marketing permissions не змішуються.
- **S05:** безпечні invitations, authorization, audit, approvals і захист персональних даних.
- **S06:** фактична staging/native/offline/recovery готовність до відповідного launch.
- **S07:** server-authoritative KPI, два незалежні W4, мінімальна legal attribution та qualitative Beta analytics.

**Стратегічних суперечностей не виявлено.** Це не стверджує фактичну імплементаційну або launch readiness.

## 30. Risk Register

| Ризик                                    | Рівень   | Контроль                       |
| ---------------------------------------- | -------- | ------------------------------ |
| Real Beta invites до Legal GO            | Critical | S04 L1 gate                    |
| Маркетинг ненадійного продукту           | High     | S05/S06 evidence               |
| Порушення Athlete privacy                | Critical | S03/S05 rights/authorization   |
| Вигадані claims/testimonials             | High     | Verified marketing             |
| Недостатньо Athlete для workflow testing | High     | М'який орієнтир 2–3            |
| Невірний W4 через незавершені вікна      | High     | Eligible cohorts + as-of       |
| Невірна статистика малої Beta            | High     | Counts + qualitative research  |
| Spam/незаконний outreach                 | High     | Lawful contact and permissions |
| Рекламні витрати без product fit         | High     | Caps, stop conditions          |
| Автоматична Beta→paid конверсія          | Critical | Explicit user authorization    |
| Неавторизована промокампанія             | High     | Owner step-up/approval         |
| Ранній international expansion           | High     | Country-specific gates         |
| Надмірне founder навантаження            | Medium   | Limited waves/support          |

## 31. Implementation Dependencies & Existing GitHub Ownership

| Issue                                                         | Ownership                      |
| ------------------------------------------------------------- | ------------------------------ |
| [#388](https://github.com/sauron9521/gym-platform/issues/388) | Landing messaging/marketing UX |
| [#393](https://github.com/sauron9521/gym-platform/issues/393) | Brand, domains, routing        |
| [#352](https://github.com/sauron9521/gym-platform/issues/352) | Beta readiness GO/NO-GO        |
| [#527](https://github.com/sauron9521/gym-platform/issues/527) | Future no-card trial           |
| [#528](https://github.com/sauron9521/gym-platform/issues/528) | Promo trials/codes             |
| [#541](https://github.com/sauron9521/gym-platform/issues/541) | Paid offers                    |
| [#550](https://github.com/sauron9521/gym-platform/issues/550) | Business Governance            |
| [#560](https://github.com/sauron9521/gym-platform/issues/560) | Operational go-live gates      |
| [#588](https://github.com/sauron9521/gym-platform/issues/588) | Strategic Roadmap              |
| [#353](https://github.com/sauron9521/gym-platform/issues/353) | Technical Master Roadmap       |

**Рішення 25A:** owner особисто погоджує кампанії та launch. S08 — **docs-only** зараз; не створювати дубльований GTM epic, не mass-edit implementation Issues/PR/labels/milestones.

**Після S01–S12**: один evidence-based audit code/Issues/PR, dedup/retire only proven obsolete tasks, assign dependencies/milestones та create only missing implementation slices. Якщо реальна Beta раніше — обов'язкові gates не відкладаються.

## 32. Remaining Operational Decisions

До конкретних дій потрібно визначити:

1. Фінальний Landing Hero/CTA copy.
2. Waitlist мінімальні поля/retention і legitimate processing.
3. Критерії screening тренерів без зайвих PII.
4. Розміри хвиль recruitment та календар onboarding.
5. Реальний support/interviews workflow і завершення Beta доступу.
6. Campaign budget caps, content cadence та lawful outreach rules.
7. GTM attribution з S07 без excessive tracking; quality thresholds.
8. Controlled Expansion cap/pause/owner GO.
9. Фінальні prices/quotas, trials, payment/store conditions після S09/Billing approvals.
10. Країни наступної expansion хвилі та minimum local support.

Це **операційні/імплементаційні рішення**, не підстава тихо змінювати затверджені S01–S08 або припускати готовність Gate.

## 33. Owner Approval, Publication & Change Control

**Власник явно затвердив S08 Go-to-Market Strategy v1.0 2026-11-22 після 25/25 відповідей та фінального OWNER REVIEW.**

Порядок публікації:

1. Один docs-only PR із канонічним S08 і documentation indexes.
2. Перевірити Markdown formatting, CI та відсутність code/DB/implementation Issue змін.
3. **Тільки owner manual review та merge**; assistant не зливає.
4. Після фактичного merge перевірити S08 у `main` та позначити [#588](https://github.com/sauron9521/gym-platform/issues/588) як **APPROVED + RECORDED**.
5. Після S01–S12 — окремий comprehensive backlog audit; зараз жодної реалізаційної перебудови.
6. **S09 NOT_STARTED**, поки немає окремої owner-команди.
7. Майбутня зміна policy — versioned revision, impact review S01–S07 та explicit owner approval.

**S01–S07 APPROVED + RECORDED; S08 OWNER APPROVED / publication pending owner merge; S09–S12 NOT_STARTED. S04/S05/S06 gates залишаються NO-GO до незалежного evidence та owner GO.**
