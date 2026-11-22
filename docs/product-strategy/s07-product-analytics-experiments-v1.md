# OVRANTO — S07 Product Analytics & Experiments v1.0

**Статус рішення: OWNER APPROVED — затверджено власником 2026-11-22 без змін.**  
**Напрям:** S07 — Product Analytics & Experiments.  
**Підстава:** 23 первинні відповіді, два пропущені первинні питання, закриті U01/U02, та остаточні уточнення U03/U04 щодо demographics і Billing. Власник явно затвердив S07 v1.0 після OWNER REVIEW.  
**Затверджені залежності:** [S01](s01-product-strategy-v1.md), [S02](s02-customer-experience-v1.md), [S03](s03-privacy-data-ownership-v1.md), [S04](s04-legal-compliance-v1.md), [S05](s05-security-trust-v1.md), [S06](s06-production-reliability-v1.md) — APPROVED + RECORDED.  
**Стратегічний roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа рішення:** S07 затверджує **продуктову аналітичну політику**, а не фактичну реалізацію подій, дашбордів, історичних даних чи законність конкретного tracking SDK. Цей docs-only PR очікує **ручного merge власником**; статус **RECORDED** настає після перевірки канонічного документа у `main`. S04 Legal L1/L2/L3, S05 Security і S06 Reliability gates залишаються **NO-GO** до фактичного evidence та незалежних owner decisions. **S08 NOT_STARTED**; реалізаційні Issues не змінюються зараз.

## 1. Strategic Objective

OVRANTO дотримується **Evidence-Based Product Development + Privacy by Design + Metric Governance**. Аналітика повинна відповідати, чи тренери й спортсмени отримують реальну користь, де виникають труднощі та які зміни обґрунтовані.

Цілі: виміряти activation, виявити friction у user journeys, перевірити engagement/retention, відокремити продуктові проблеми від технічних, формувати відтворювані гіпотези й робити це без надлишкових персональних даних.

Бізнесові факти важливіші за кількість реєстрацій, кліків, встановлень і переглядів. Не будувати warehouse, окремий analytics microservice чи складне event streaming до доведеної потреби.

## 2. North Star Metric

**Рішення 01A:** **Weekly Active Coached Trainer–Athlete Pairs** — кількість унікальних пар тренер–спортсмен, у межах співпраці яких протягом звітного тижня було принаймні одне **серверно підтверджене завершене тренування**.

- Одиниця — **пара**, не користувач і не тренування.
- Пара враховується максимум один раз за тиждень; кілька workouts не множать її.
- Атрибуція відбувається за дозволеним і коректним Trainer–Athlete relationship, а не за email/device.
- Історична аналітика не відновлює тренеру відкликані права на приватні workout records.
- При кількох тренерських зв'язках має бути однозначне, версійне правило attribution.

**Independent Athletes** відстежуються окремою метрикою **Weekly Active Independent Athletes** за підтвердженими тренуваннями. North Star не замінює Trainer/Athlete W4 або activation. Числову ціль для North Star визначати лише після baseline.

Технічний KPI Dictionary уточнить звітний тиждень, multi-trainer attribution та історичні terminated relationships, не змінюючи стратегічної суті.

## 3. Trainer Activation

**Рішення 02A, без зміни S01.** **Trainer Activated** — тренер уперше фактично призначив тренувальну програму хоча б одному реальному спортсмену.

Не рахувати реєстрацію, email verification, вхід у Dashboard, приватний шаблон/чернетку або програму без призначення. Необхідне серверне підтвердження дії та однозначний activation timestamp.

## 4. Athlete Activation

**Рішення 03A, без зміни S01.** **Athlete Activated** — спортсмен уперше завершив тренування, підтверджене авторитетним серверним станом.

Не рахувати install, login, accepted invitation, відкриття Workout, незавершену сесію чи локальний pending draft без server acknowledgment/reconciliation. Те саме правило діє для coached та independent Athlete; перевстановлення застосунку чи зміна пристрою не створює повторну активацію.

## 5. Trainer & Athlete W4 Retention

**Рішення 04A, без зміни S01.**

| Показник                 | Ціль     | Критерій W4                                                                                                |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| **Trainer W4 Retention** | **≥50%** | Призначення/оновлення програми, перегляд реальних результатів або feedback у дні **22–28** після активації |
| **Athlete W4 Retention** | **≥50%** | Принаймні одне завершене тренування у дні **22–28** після активації                                        |

**Формула для кожної ролі:** число W4-активних / число активованих відповідної ролі з повним W4-вікном. Показувати **окремо** чисельник, знаменник, `asOf` та роль; не включати неповні когорти, не усереднювати ролі, не замінювати значущу дію login і не підміняти дні 22–28 календарним місяцем.

Trainer review потребує достовірного й авторизованого сигналу, а не неперевіреного frontend click. Запізнілі offline events перераховуються за версійною політикою, не змінюючи S01 definition.

У Beta 5–10 тренерів одна особа суттєво впливає на відсоток: наприклад, при п'яти активованих тренерах ціль ≥50% потребує **трьох** утриманих. Мала когорта не доводить product-market fit статистично.

## 6. Additional Product KPIs

**Рішення 05A+B+C+D+E:**

- **Acquisition & Activation:** invite → signup → activation conversion, окремо за ролями й каналами.
- **Time to First Value:** час від задокументованої стартової точки до першого реального призначення Trainer або підтвердженого workout Athlete.
- **Product Engagement:** assignment → completed workout, частота підтверджених тренувань, значуща Trainer робота з результатами.
- **UX Reliability:** interrupted workouts, offline/reconciliation conflicts, resume/recovery; узгоджені S06 telemetry signals без дублювання технічного моніторингу.
- **Qualitative Feedback:** добровільні інтерв'ю, звернення, UX observations і причини відмови від сценарію.

Числові цілі додаткових KPI не встановлювати без baseline.

## 7. Product Funnels

**Рішення 06A:** три різні, але пов'язані user journeys.

- **Trainer:** signup → onboarding → approval → program preparation → first assignment → athlete activity → review/feedback.
- **Athlete:** invite або independent entry → signup → onboarding → first completed workout → repeat workout → W4.
- **Relationship:** invitation created → accepted → valid relationship → assigned program → completed workout → Trainer review.

Кожний перехід має визначену одиницю підрахунку, чисельник/знаменник, conversion window, звітний період і quality status. Не змішувати екрани, фактичні дії та активацію в одну подію.

## 8. Identity, Roles & Deduplication

**Рішення 07A.** Канонічна account identity та окремий role context.

- Один користувач на кількох пристроях — один account.
- Один account може належати до різних role-level cohorts, але не подвоюватися в account-level KPI.
- Унікальні пари не дорівнюють кількості унікальних користувачів.
- Durable business/event IDs із deduplication для retries та reconciliation.
- Ніякого прихованого cross-device fingerprinting/advertising-ID identity linking.

## 9. Time & Cohort Policy

**Рішення 08A:** зберігати event timestamps в **UTC**, а reporting timezone визначати окремо. Розрізняти effective business-event time, server confirmation, ingestion time та звітний `asOf`.

W4 прив'язаний до activation anchor і точно визначених днів 22–28. Для late-arriving offline подій перевірити достовірність часу, канонічний серверний факт, idempotency, відтворюваність попереднього as-of; не домислювати невідомі timestamps. Точні часові межі, reporting zone та finalization lag — versioned KPI Dictionary.

## 10. Cohort Segmentation

**Рішення 09A+B+C+D з уточненням U03A (початкове 09E замінено).**

**Beta дозволяє лише мінімально обґрунтовані виміри:** Trainer/Athlete role, activation week/window, Web/Android/iOS platform та invitation source/onboarding path **лише за належної правової підстави й визначеної мети**.

**Не збирати для продуктової аналітики Beta** деталізовану географію, демографію чи персональні профілі.

Майбутній перегляд потребує бізнесової мети, обмежених атрибутів, законної підстави, anti-reidentification review, retention/access safeguards та окремого рішення.

У маленьких групах suppression або відсутність деталізованих сегментів; exact Owner W4 numerator/denominator можливі в захищеному контексті, але не створюють права на unrestricted breakdowns.

## 11. Product Analytics Source of Truth

**Остаточне рішення U01A:** авторитетні продуктові KPI будуються з **серверно підтверджених доменних фактів** NestJS API/PostgreSQL.

Приклади: program assigned, valid Trainer–Athlete relationship, completed workout, значуща підтверджена Trainer review/feedback action. Client Web/Expo telemetry дозволена лише як **допоміжні UX-сигнали** (onboarding step, help usage, validation error), а не джерело truth для workout completion, assignment або оплат.

Не використовувати optimistic UI, success-screen або frontend click як доказ відповідного доменного факту. На Beta достатньо перевірюваних server-side агрегатів; окремий дубльований warehouse не потрібен.

## 12. Event Taxonomy & Typed Contracts

**Остаточне рішення U02A:** єдиний **versioned Event Dictionary** для всіх застосунків.

Для кожної події документувати:

| Контракт       | Вимога                                        |
| -------------- | --------------------------------------------- |
| Name/version   | Канонічна назва, schema version, deprecation  |
| Ownership      | Domain owner і авторитетний producer          |
| Trigger        | Чіткий момент виникнення бізнес-факту         |
| Identity       | Event/domain identifiers, deduplication       |
| Time           | Тип часу: effective, confirmation, ingestion  |
| Payload        | Типізовані, валідовані мінімальні атрибути    |
| Privacy        | Data category, purpose, access, retention     |
| Metric mapping | Які KPI і за яких правил використовують event |

Використовувати shared TypeScript/Zod contracts у Turborepo, якщо це узгодиться з архітектурою; конкретні пакети/шляхи — implementation decision. Dictionary **не потребує** запуску event-bus/microservice платформи.

## 13. MVP Product Event Categories

**Рішення 12A+B+C+D, 12E уточнено U04A.**

- **Activation:** TrainerActivated, AthleteActivated.
- **Invitations/Programs:** InvitationCreated, InvitationAccepted, ProgramPublished, ProgramAssigned.
- **Workout:** WorkoutCompleted і потрібні підтверджені зміни фактичних результатів.
- **Trainer Engagement:** ProgramUpdated, перевірений WorkoutResultsReviewed, WorkoutFeedbackSubmitted.

Це **семантичні приклади**, а не фінальна event naming convention чи дозвіл копіювати приватні workout records.

**Future Billing:** можна підготувати contracts та ownership, але тільки реальні provider/ledger-confirmed payment facts після застосовних commercial/legal gates стають основою paid KPI. Не створювати фіктивні revenue/subscription events.

## 14. Client-side UX Tracking

**Рішення 13A.** Мінімальні purpose-based UX-події, з визначеними правовими підставами за S03/S04, optional consents там, де це необхідно, та окремими правилами відмови/відкликання.

Не дозволяти blanket automatic capture усіх натискань, form values, HTTP payloads, приватних коментарів або session replay без окремого обґрунтування. Додавання third-party SDK не дає автоматичної ліцензії на unrestricted tracking.

## 15. Offline Events & Data Integrity

**Рішення 14A, у відповідності з S02/S05/S06.**

- Один підтверджений факт — максимум один KPI contribution.
- Interrupted PATCH/lost response не створюють новий workout fact; **read-only reconciliation first**.
- Pending local draft ≠ server-confirmed completion.
- Stable IDs, idempotency, revision-aware conflict handling, жодного silent overwrite.
- Account switching, revoked access і deletion не дозволяють cross-account mixing або resurrection.
- Ingestion може повторно доставляти подію, але підрахунок — логічно один.
- Затримані події та історичні коригування мають відтворюваний audit trail.

## 16. Analytics Privacy & Legal Basis

**Рішення 15A.** Для кожної категорії: мета, lawful basis, мінімальні поля, controller/processor roles, vendor review, access controls, retention, correction/deletion і consent withdrawal за застосовністю.

Не змішувати Terms acceptance, надання Privacy Notice і optional permissions; жодної blanket consent. Реальні SDK/vendoring/data flows проходять legal/privacy review **до** збирання.

## 17. Event Payload Minimization

**Рішення 16A.** Event ID, name/version, timestamp, мінімальний account/role reference, потрібний domain ID та контрольовані технічні атрибути. Без паролів, access/refresh tokens, MFA codes, full HTTP bodies, вільного feedback text, приватних шаблонів, повних workout records, медичних даних, точної геолокації або демографічних профілів Beta.

Payload extension вимагає нового purpose/privacy/security review.

## 18. Analytics Retention, Deletion & Corrections

**Рішення 17A/19A.** Категорійний retention за S03/S04/S05; **жодних вигаданих числових строків**.

Окремі правила raw events, optional UX telemetry, aggregates, cohort snapshots, diagnostics і backups. Deletion/correction або consent revocation мають відповідний обґрунтований вплив на derived data. Агрегування чи видалення одного identifier **не доводить анонімність**. Restore не повинен відроджувати видалені дані чи відкликані права.

## 19. Analytics Access & RBAC

**Рішення 18A.** Owner/Super Admin та тільки явно авторизовані адміністративні ролі через server-side capabilities, audit і least privilege. `ADMIN` сам по собі не відкриває усі raw events. Trainer не отримує platform-wide private Athlete analytics.

Small-cohort safeguards: suppression або відсутність деталізованого breakdown при ризику reidentification; точні стратегічні Beta KPI лише в захищеному Owner контексті. Платформені агрегати не обходять персональних permission grants S03/S05.

## 20. Product Analytics Dashboard

**Рішення 20A+B+C+D.**

- **Activation/Retention:** Trainer/Athlete Activated, окремі W4 ≥50%, чисельники/знаменники, `asOf`, North Star після підтвердження даних.
- **Funnels:** onboarding, invite acceptance, program assignment, workout completion.
- **Engagement:** Time to First Value, confirmed workout frequency, meaningful Trainer engagement.
- **Reliability Impact:** погоджені UX-signals offline conflicts/recovery із S06, без дублювання monitoring source.
- **Quality:** freshness, coverage, late/missing events, metric definition version.

Відсутність або частковість даних позначати **Not available / Incomplete / Insufficient data**, не вигаданими нулями чи графіками. Не будувати customer-level BI із приватними workout payloads до Beta.

## 21. Product, Billing & Reliability Separation

**Рішення 21A/U04A.**

| Напрям      | Канонічне ownership | Вимірювання                                 |
| ----------- | ------------------- | ------------------------------------------- |
| Product     | S07                 | Activation, funnels, retention, engagement  |
| Billing     | E21 / S09           | Paid subs, MRR, refunds, trial-to-paid      |
| Reliability | S06                 | Availability, latency, crashes, sync safety |
| Governance  | E22 #550            | Operational/staff/support KPIs, access      |

Спільний Admin UX допускається, **але не спільний неконтрольований source of truth**. Не змішувати billing churn із продуктовою неактивністю, outage із engagement або revenue з frontend clicks. Майбутні Billing контракти погоджуються з #532–535. Trial, promo та admin grants не є received revenue; success redirect не є підтвердженням платежу.

## 22. Beta Research & Qualitative Experiments

**Рішення 22A.** Для першої **безкоштовної чотиритижневої Beta на 5–10 тренерів** використовувати добровільні UX-інтерв'ю, сценарні тести, onboarding observations, описові KPI і документовані гіпотези.

Не вважати statistical A/B на такій малій вибірці надійним способом встановлення причинного ефекту. Не створювати обов'язкових щотижневих анкет чи маніпулятивних win-back flows проти S02.

## 23. Future A/B Experimentation

**Рішення 23A+B+C+D.** Пізніше, коли з'явиться достатня вибірка:

- Заздалегідь визначена гіпотеза, primary та guardrail metrics.
- Стабільна assignment unit/randomization, cross-device consistency.
- Sample-size/power policy, observation window, analysis/stop criteria.
- Безпечний rollback/stop при security/privacy/reliability порушеннях.

Experiment assignment **не дорівнює** release feature flags S06. A/B не дозволяє обійти consent, prices, authorization, payments чи legal conditions.

## 24. Data Quality & Metric Governance

**Рішення 24A+B+C+D.** До Beta-рішень потрібні:

1. Test fixtures Trainer/Athlete activation і обох W4.
2. Domain-event deduplication та reconciliation із confirmed workout totals.
3. Late/missing event handling, data freshness/coverage.
4. Versioned KPI Dictionary, reproducible `asOf` snapshots.
5. Ручна перевірка малих Beta cohorts.
6. Версійні формули, задокументований вплив змін і можливість реконструювати попередній зріз.

Якщо недостатньо достовірних даних, показник **unavailable**, а не вигаданий.

## 25. Analytics Architecture & Cost Control

**Цільова схема:** **NestJS Domain State → PostgreSQL → Validated Metrics/Events → Authorized Analytics API → Admin Dashboard**. Допоміжні Client UX events окремо й із мінімізацією.

- Server-authoritative business KPI, shared event contracts, мінімум нових компонентів.
- Не дублювати Prisma business models.
- Індекси, snapshots, caches/materialized views — після query/cost evidence.
- Без обов'язкових warehouse, Kafka чи analytics microservices до Beta.
- Notifications [#563](https://github.com/sauron9521/gym-platform/issues/563) можуть ділитися деякими контрактами; **Transactional Notification Outbox** не стає автоматично всією системою продуктової аналітики.
- Імплементаційні пакети, file paths, сторонні vendors — після стратегічного циклу та репозиторного аудиту.

## 26. MVP / Beta / Paid / Later

| Напрям         | MVP / Beta                                    | Later                              |
| -------------- | --------------------------------------------- | ---------------------------------- |
| North Star     | Версійне визначення, первинні достовірні дані | Розширені розрізи                  |
| Activation     | Обидві ролі за S01                            | Нові patterns                      |
| W4             | Два незалежні ≥50%, повні cohort windows      | Додаткові cohorts                  |
| Funnels        | Основні Trainer/Athlete journeys              | Attribution expansion              |
| Events         | Мінімальний versioned dictionary/contracts    | Advanced governance                |
| Quality        | Fixtures, dedup, reconciliation               | Automated anomaly detection        |
| Dashboard      | Owner KPI і freshness                         | Advanced BI                        |
| Privacy        | Legal basis, minimization, rights             | Нові погоджені цілі                |
| Demographics   | **Відкладено**                                | Окреме privacy/owner review        |
| Billing        | **Жодних вигаданих paid facts**               | Реальні KPI після commercial gates |
| Experiments    | UX interviews/scenario tests                  | Statistical A/B з power policy     |
| Infrastructure | Minimal sufficient architecture               | Warehouse/streaming за потребою    |

Надійний activation/W4 вимір — до Beta, але повний BI-продукт не є Beta вимогою.

## 27. Compatibility With S01–S06

- **S01:** Trainer-first, Ukraine-first, 5–10 тренерів/4 тижні/безкоштовно; незалежні Trainer/Athlete W4 ≥50%. North Star їх не замінює.
- **S02:** реальні workout facts, pending drafts, truthful sync/offline states, feedback і добровільні дослідження.
- **S03:** scoped athlete access, revocation/deletion/export, category retention, backup anti-resurrection; demographics у Beta відкладено.
- **S04:** Terms/Privacy Notice/optional grants — окремо; L1/L2/L3 незалежні legal/commercial gates; paid KPI лише за реальними операціями.
- **S05:** default-deny, RBAC/capabilities, PII minimization, audits, заборона обходу revoked coach access.
- **S06:** server acknowledgment, idempotency, reconciliation, observability, критичні reliability gates; product metrics не замінюють SLO/RPO/RTO.

**Стратегічних конфліктів після U01–U04 не залишилося.** Це не стверджує фактичної сумісності ще не реалізованих систем.

## 28. Current GitHub Ownership & Backlog Sequencing

| Наявний Issue                                                 | Ownership                      |
| ------------------------------------------------------------- | ------------------------------ |
| [#296](https://github.com/sauron9521/gym-platform/issues/296) | General Admin metrics          |
| [#532](https://github.com/sauron9521/gym-platform/issues/532) | Billing metrics dictionary     |
| [#533](https://github.com/sauron9521/gym-platform/issues/533) | Billing analytics API          |
| [#534](https://github.com/sauron9521/gym-platform/issues/534) | Billing Admin dashboard        |
| [#535](https://github.com/sauron9521/gym-platform/issues/535) | Deferred advanced paid cohorts |
| [#550](https://github.com/sauron9521/gym-platform/issues/550) | Business Governance            |
| [#297](https://github.com/sauron9521/gym-platform/issues/297) | Privacy/settings               |
| [#353](https://github.com/sauron9521/gym-platform/issues/353) | Master Technical Roadmap       |
| [#588](https://github.com/sauron9521/gym-platform/issues/588) | Strategic Roadmap              |

**Рішення 25A та окрема owner instruction:** затвердити всі **S01–S12** до масового refactoring implementation backlog. Зараз — жодних нових duplicate epics, Issues, перепризначень пріоритетів/milestones або позначок «shipped» із самої стратегії.

Після S12 і окремої команди: перевірити code/API/Prisma/Admin UI й existing Issues; reconciliate scope з approved strategies; доведені дублікати закрити, milestones/priority оновити; створити тільки missing tasks; виконувати по одному малому PR із CI, owner review та ручним merge. **Якщо реальна Beta планується раніше, її критичні analytics/data integrity/privacy/security/reliability gates не відкладаються.**

## 29. Risk Register

| Ризик                                | Рівень   | Контроль                                    |
| ------------------------------------ | -------- | ------------------------------------------- |
| Неправильні W4 знаменники            | High     | Full-window fixtures, as-of                 |
| Duplicate offline KPI facts          | High     | Idempotency, reconciliation                 |
| Хибна pair/multi-trainer attribution | High     | Domain relationships, версійна політика     |
| Small-cohort reidentification        | High     | RBAC, suppression                           |
| Надмірні demographic дані            | High     | U03A — Beta deferred                        |
| Фіктивний revenue                    | Critical | U04A — provider/ledger-confirmed facts only |
| PII або приватний текст в events     | Critical | Payload validation/minimization             |
| UX click як заміна business fact     | High     | U01A server authoritative                   |
| Розбіжність схем подій               | High     | U02A event versioning                       |
| Хибна причинність із маленької Beta  | High     | Інтерв'ю; deferred A/B                      |
| Невідтворюваний historical KPI       | High     | Dictionary + snapshots                      |
| Stale/missing dashboard data         | Medium   | Quality/as-of statuses                      |
| Надлишкова інфраструктура            | Medium   | Minimal architecture                        |
| Обхід deletion/retention             | Critical | S03/S04/backup review                       |

Це ризики цільової архітектури, не твердження про наявні інциденти.

## 30. Open Implementation Decisions

Після U01–U04 відкритих **стратегічних виборів первинного опитування немає**. У технічній фазі визначити:

1. Exact Weekly Active Coached Pair formula, calendar week і multi-trainer attribution.
2. Reporting timezone, W4 day-boundary contract.
3. Time to First Value start point для кожної ролі.
4. Late event processing та historical cohort recalculation.
5. Dictionary schema/packages і реальні domain/API/Prisma mappings.
6. Privacy-approved event payload та retention durations.
7. Small-cohort suppression thresholds.
8. Data freshness/completeness thresholds.
9. Owner Dashboard API і capabilities.
10. Потребу в third-party provider та його data processing terms.
11. Server-side confirmation for Trainer result review.
12. Beta fixture/reconciliation acceptance.
13. Future Billing integration із E21 без дублювання.

ADR/implementation decisions не повинні мовчки змінювати S01–S07 або видавати недоведені значення за правду.

## 31. Owner Approval, Publication & Change Control

**Owner явно затвердив S07 Product Analytics & Experiments v1.0 без змін 2026-11-22**, після 23 первинних відповідей, уточнень U01–U04 та розгляду повної редакції v1.0.

Наступний порядок:

1. Один **docs-only PR** із цим документом і документаційними індексами.
2. CI, перевірка scope (без code/DB/Issues/deploy змін).
3. **Тільки owner manual review та merge**; автоматичний merge заборонений.
4. Перевірити канонічний S07 у `main`, тоді позначити **APPROVED + RECORDED** у [#588](https://github.com/sauron9521/gym-platform/issues/588).
5. Відкласти масове reconciliation implementation Issues до завершення S01–S12.
6. **S08 NOT_STARTED** до окремої команди.
7. Майбутня зміна policy — versioned revision з explicit owner approval, impact review на S01–S06.

**S01–S06 APPROVED + RECORDED; S07 OWNER APPROVED / publication pending owner merge; S08–S12 NOT_STARTED. S04/S05/S06 Beta gates залишаються NO-GO до фактичних доказів.**
