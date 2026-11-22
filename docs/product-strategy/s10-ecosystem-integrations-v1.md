# OVRANTO — S10 Ecosystem & Integrations Strategy v1.0

**Статус рішення: OWNER APPROVED — явно затверджено власником 2026-11-22 після S10 v0.1 OWNER REVIEW.**  
**Напрям:** S10 — Ecosystem & Integrations.  
**Підстава:** 25/25 відповідей власника на стратегічні питання та фінальне «все ок, затверджую» після огляду S10 v0.1.  
**Затверджені залежності:** S01–S09 — APPROVED + RECORDED.  
**Стратегічний Roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний Roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа рішення:** S10 є затвердженою **політикою інтеграцій**, а не схваленням реалізації чи production-використання HealthKit, Health Connect, сторонніх API або нових Health data flows. S10 v1.0 пропонується в **одному docs-only PR** для ручного merge власником; статус **RECORDED** настане тільки після перевірки канонічного документа у main. Незалежні S04 Legal, S05 Security, S06 Reliability, platform/store, privacy й provider gates залишаються **NO-GO без evidence і окремого owner GO**. Implementation backlog — лише після комплексного аудиту по завершенні S01–S12. **S11 NOT_STARTED.**

## 1. Strategic Objective

OVRANTO приймає підхід **Export-First + Athlete Data Ownership + Optional Integrations + Server-Authoritative Workouts**.

Мета — надати Athlete контроль над історією та можливість переносити дані, добровільно доповнювати підтверджені тренування зовнішнім контекстом і обмінюватися даними без перетворення OVRANTO на медичний сервіс або залежний від сторонніх API tracker.

Пріоритет: S03 portability/privacy → автономність Trainer/Athlete workflows → власний workout source of truth → поетапні Health integrations після Beta → опціональні партнерські сервіси за доведеним попитом. Усі подальші функції мають окремий legal/security/device/reliability/cost review та власне owner GO.

## 2. Integration Priorities

**Рішення 01A — Export-first.**

Спочатку забезпечити власний workout export і можливість перенесення історії за S03. **HealthKit/Health Connect — після Beta**, не обов'язкова умова першого Beta GO.

Інтеграції не затримують основні workflows, privacy rights, mobile reliability, offline recovery, юридичні вимоги або W4-аналітику. Future Health integrations вимкнені за замовчуванням.

## 3. Cross-Platform Product Policy

**Рішення 02A.** Для iOS та Android зберігати єдину бізнесову політику й versioned typed contracts: permission semantics, ownership/sharing, provenance, deduplication, import data integrity, зрозумілі connect/disconnect UX states.

**Порядок реалізації iOS vs Android не затверджено**: визначати після фактичної оцінки API readiness, попиту, ризиків, QA й витрат. Єдина продуктова політика не означає однакових SDK чи гарантії одночасного релізу.

## 4. Product Role of Integrations

**Рішення 03A.** Інтеграції **доповнюють Athlete history та обмін підтвердженими тренуваннями**, не замінюючи OVRANTO.

OVRANTO залишається authoritative для власних Training Programs, workout assignments, completed workouts, weights/reps/sets, Coach feedback, історії та S07 продуктового event truth. Зовнішні дані не автоматично прирівнюються до verified workouts або fitness/medical facts.

Не позиціонувати платформу як медичний diagnostic/health warehouse.

## 5. Optional Integrations Principle

**Рішення 04A.** **Усі сторонні інтеграції добровільні.**

Реєстрація, базовий Trainer/Athlete workflow, програми, виконання, history, progress, free/paid доступ у належних межах функціонують без HealthKit, Health Connect, smartwatches, Garmin, Strava або provider credentials. Provider outage, revoked permissions чи API зміни не повинні блокувати core workflows.

Не вимагати Health consent під час реєстрації чи Beta onboarding.

## 6. Initial Health Data Scope

**Рішення 05A.** Перша Health integration обмежена **метаданими тренувальних сесій**, за підтримки провайдера та узгодженої семантики:

- Тип тренувальної сесії.
- Початок/кінець або тривалість.
- Часові позначки.
- Статус тренування/сесії, **якщо платформа надає відповідне поле з однозначним змістом**.

Не включати за замовчуванням physiological signals (пульс, сон, стрес, ECG), діагнози, медичні нотатки, протипоказання, необмежені health records або зовнішні sets/reps/weights без окремої перевірки походження та mapping.

Додавання категорії — нова purpose/privacy/provider/safety оцінка. У Beta медичні дані залишаються поза MVP за S03.

## 7. Permission Architecture

**Рішення 06A.** Окремі **purpose-based і category-scoped** дозволи, без prechecked default:

- Platform read, лише для потрібної категорії.
- Platform write, якщо така функція окремо схвалена.
- Optional server import за конкретною правовою підставою й функціональною потребою.
- Optional sharing imported-data з Trainer за окремим scope.

Розділяти **OS permission**, product opt-in, **legal basis** (consent де застосовно), Trainer sharing grant та server-side authorization. Погодження Terms не є blanket Health permission.

Перевіряти актуальний стан дозволів перед операціями; його зміна або відмова повинні мати зрозумілий UX.

## 8. Data Minimization & Storage

**Рішення 07A.** **Device-local by default**, коли серверне зберігання не потрібне конкретній функції.

**Local:** читати та обробляти тільки допустимий обсяг на пристрої, застосовувати platform protection і lifecycle controls без автоматичного копіювання всіх даних у PostgreSQL.

**Authorized server import:** документована purpose/legal basis, мінімальні поля, поточна авторизація, відповідні retention/deletion, provenance та захищена передача. Дані не передавати автоматично рекламним або AI-аналітичним провайдерам.

Точні schema/retention/локальний кеш визначаються окремо за S03/S04/S05 перед впровадженням.

## 9. Trainer Access to Imported Data

**Рішення 08A.** **Trainer не бачить зовнішні Health-дані Athlete за замовчуванням.**

Доступ можливий тільки за актуальних active Trainer–Athlete relationship, explicit applicable Athlete sharing scope, lawful basis та server-side resource authorization. Relationship сам по собі не відкриває всі фізичні чи health-показники.

Після termination/revocation звичайний доступ Trainer припиняється, у тому числі до подальшого експорту за можливості контролю OVRANTO. Існуючі позасистемні копії неможливо гарантовано відкликати технічно; їх подальше використання охоплюють S04 legal rules.

## 10. Synchronization Direction

**Рішення 09A.** **Спочатку обмежений read/import** з HealthKit/Health Connect до OVRANTO, із можливістю device-only обробки без server persist.

**Write/export назад у Health — лише окремий наступний етап** із platform permission, product mapping, producer provenance та тестами циклів. Повну автоматичну двосторонню синхронізацію не включати в початкову фазу.

Read/import не означає безумовне створення canonical OVRANTO Workout або безумовне копіювання всіх записів на сервер.

## 11. Workout Authority & Conflict Resolution

**Рішення 10A.** Власні підтверджені записи OVRANTO не перезаписуються непомітно зовнішніми даними.

Зовнішні записи мають source/provenance. Conflict у sets, reps, weights, timestamps або status — показати як відмінність та вимагати **явного дозволеного рішення користувача**, замість last-write-wins чи provider-first.

Імпортована зовнішня сесія не є автоматично OVRANTO Completed Workout і не може непомітно зарахуватися до S07 W4/North Star. Future promote-to-workout можливий лише за окремим verified domain/authorization design.

## 12. Sync Integrity & Provenance

**Рішення 11A+B+C+D.** Вимоги:

1. **Source/provenance metadata**, зовнішні stable identifiers за наявності, provider source, версія mapping.
2. **Idempotency і deduplication** на стабільних ключах, а не timestamp-only.
3. **Loop prevention** для майбутнього Health write → Health read.
4. **Canonical units**, timezone/UTC/DST й explicit mapping for unknown/ambiguous fields.
5. **Bounded retries, checkpoints та recovery** для interrupted calls, ambiguous writes/lost responses/app resume.
6. **Read-only reconciliation** authoritative state, коли запис міг пройти без відповіді; заборона небезпечних автоматичних повторних non-idempotent mutations.

Узгодити з S06 offline draft/native recovery і тестувати cross-platform data integrity.

## 13. Disconnect, Revocation & Imported Data

**Рішення 12A.** Після revocation/disconnect негайно припиняти майбутній доступ/дозволені запити, де це контролюється OVRANTO; припиняти dependent sync jobs, не використовувати revoked credentials, коректно показувати disconnected state.

Розділяти п'ять подій: **revoke platform permission**, **disconnect provider**, **stop sync**, **delete previously imported copies**, **delete OVRANTO account**. Перші три не встановлюють автоматично правовий статус усіх вже імпортованих копій. Надати належне керування відповідно до retention/deletion/legal rights і protection від backup/offline reappearance.

Не обіцяти технічне відкликання даних із незалежних зовнішніх систем або раніше скачаних копій.

## 14. Historical Import & Background Sync

**Рішення 13A.** Мінімальний initial history window; platform-supported pagination/change tracking, incremental checkpoints, bounded retry/cost, user opt-in для розширеного backfill та можливість cancellation.

Не очікувати гарантованого background execution на iOS/Android і не завантажувати всю історію заново при кожному запуску. Обробляти неповні, змінені, видалені або недоступні provider records; користувач повинен бачити чесний sync state.

## 15. Wearable Platform Priorities

**Рішення 14A+B.** Першими розглядати **Apple Watch через iOS/HealthKit** та **Android-сумісні watch devices через Health Connect**, лише коли відповідні метадані фактично доступні й дозволені.

Це не гарантія підтримки всіх моделей або прямого з'єднання з кожним годинником. **Garmin Connect / Strava — пізніше** за окремими evidence та decision.

## 16. Wearable Integration Architecture

**Рішення 15A.** Перевага **офіційним OS-level APIs**. Direct vendor APIs допускаються після real demand, provider access/terms, privacy/security, підтримуваних data contracts, owner capacity та S09 economics.

Не будувати власний universal Bluetooth layer без конкретного use case й device evidence.

## 17. Wearable Data Safety

**Рішення 16A.** Тільки дані, необхідні підтвердженій функції.

На першій хвилі відсутні medical scoring, діагностика, автоматична оцінка стану здоров'я, алгоритмічна зміна workout load лише через wearable signals, масовий збір physiological data.

Майбутні медичні/фізіологічні сценарії потребують окремої product, legal, privacy, security, safety оцінки та не можуть рекламуватися як клінічно валідовані без підтвердження.

## 18. Native Watch Applications

**Рішення 17A.** Standalone Apple Watch/Wear OS apps — **DEFERRED**.

Повернутися після стабільного Athlete Mobile, фактично працюючих відповідних Health integrations, user demand, native UX, battery/background and device QA cost analysis, owner signoff. Окремий watch app — не автоматичний наслідок HealthKit access.

## 19. Export Requirements

**Рішення 18A.** Повністю зберегти S03:

**Per-workout:** **JSON** із фактично виконаними workout results + **copyable plain text** для обміну.

**Full Athlete history:** versioned **JSON + CSV** з читабельними полями, units, форматами/версіями та необхідними metadata. Planned values не видавати за actual values.

**Автоматизацію повної історії бажано завершити до Beta**. Якщо поетапно, до неї — належний **secure legal fallback** для статутних прав на доступ/експорт із identity/authorization і documented response status. Fallback не скасовує майбутній automated export.

Додаткові FIT/GPX чи інші формати — не обов'язкові S10 features без окремого рішення.

## 20. Secure Export & Partner Access

**Рішення 19A.** **Server-side права при створенні і при кожному завантаженні**: Athlete ownership або Trainer active relationship + current sharing permission + resource scope.

Short-lived download links, minimal export scopes, controlled temporary file retention/deletion, audit та відповідний S05 step-up для небезпечних/масових експортів.

Постійні public links до private workout data заборонені; old Trainer grants не зберігають access після revocation. Раніше фізично завантажені копії не є технологічно відкличними.

## 21. Public API & Partner Platform

**Рішення 20A.** Public API, OAuth partner grants, webhook delivery — **DEFERRED** до реального попиту, security/legal/provider and S09 cost review.

Внутрішні typed API/contracts **не дорівнюють публічному API**. Перед future launch: versioned contracts, partner eligibility/terms, least-privilege scopes, credential lifecycle, rate limiting, abuse prevention, auditing, revocation, delivery guarantees й support.

Не створювати wide-scope permanent partner tokens на Beta.

## 22. Integration Architecture

**Рішення 21A.** Залишається **NestJS modular monolith + PostgreSQL/Prisma + platform-specific adapters + versioned typed contracts**.

Mobile iOS/Android adapters володіють native Health permissions/readers; platform-neutral DTOs/mapping можуть бути в shared packages. Server imports лише за підтвердженою необхідністю, правовою підставою, authentication/authorization та domain validation.

Не переносити Workout truth до SDK, не створювати provider DB/microservice на кожну інтеграцію, не розкидати vendor logic по frontend screens, не довіряти optimistic UI як authoritative workout mutation.

Точна module/file/package структура — окремий implementation design після S12 audit.

## 23. Legal, Privacy & Security Gates

**Рішення 22A+B+C+D.** Для кожної integration до реальних даних та запуску:

**Legal & Privacy:** purpose/basis, categories/sensitivity, processing scope, notice, optional permissions, Trainer sharing, retention/deletion, vendor register, договори/transfers де застосовно.

**Provider & Store:** фактичні API availability, current terms, allowed use cases, store declarations, rate limits, location-specific restrictions.

**Security:** threat model, BOLA/IDOR, tokens/key storage/rotation, local data, revocation, safe logs/export, least privilege, incident audit.

**Reliability & Operations:** device evidence, offline/recovery, support, observability, owner GO.

OS permission не замінює законної підстави всіх серверних чи сторонніх data flows. Health integrations вимкнені за замовчуванням до окремого approval.

## 24. Integration Economics

**Рішення 23A.** Для кожної інтеграції оцінювати provider/API charges, hosting/storage, native development, testing, legal/security, maintenance, support і owner time; користь за фактичним використанням та retention/UX evidence.

Встановлювати budget caps і stop criteria. **Безкоштовний SDK ≠ нульова cost of ownership**; потенційне зростання paid conversion не вважати гарантованим revenue.

Економіка відповідає S09 evidence-based margin/runway та не дозволяє скорочення S05/S06 hard gates.

## 25. Integration Release Gates

**Рішення 24A+B+C+D.**

- **I-Gate Legal/Privacy:** lawful purpose/permissions, terms, retention, vendor review і applicable S04 signoff.
- **I-Gate Security:** authentication, scoped access, revocation, token storage, IDOR/BOLA negative cases, export safety.
- **I-Gate Device/Data Integrity:** реальні iOS/Android connect, denied/revoked permission, initial import, duplicate, conflict, changed/deleted source, interrupted/lost response, reconnect, app resume, offline recovery.
- **I-Gate Operational:** observability, provider downtime behavior, rollback/disable switch, user-facing status, support/incident paths, staged rollout, stop conditions і **explicit owner GO**.

Green CI, installed SDK або працюючий simulator **не доводять native production readiness**. Зупинка інтеграції не блокує core workout виконання й не пошкоджує canonical history.

## 26. Strategy & Implementation Governance

**Рішення 25A.** Після явного owner approval S10 — лише **один docs-only PR**, formatting/CI, **manual owner merge**; після нього main verification та Roadmap #588 APPROVED + RECORDED.

Не створювати нові Health epics чи змінювати implementation code/DB/Issues/PR/milestones до **після-S12 evidence-based backlog audit**. Не починати S11 без окремої owner-команди.

## 27. Phased Integration Roadmap

| Фаза                           | Напрям                                                              | Умови                                                         |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| **I0 — Core Data Portability** | JSON + copyable workout text; full JSON/CSV history; privacy rights | S03/S04/S05, protected export, safe fallback де законно       |
| **I1 — Health Read**           | Обмежений HealthKit / Health Connect import                         | **Після Beta**, legal/security/device/owner GO                |
| **I2 — Health Write**          | Дозволена передача verified OVRANTO workouts                        | Mapping, source/loop controls, permissions, separate owner GO |
| **I3 — Wearable / Partners**   | Direct vendor integrations за попитом                               | Provider terms, user value, security, S09 economics           |
| **I4 — Public API Ecosystem**  | Partner API/webhooks                                                | Independent demand, contracts, privacy, capacity/owner GO     |

Фази не вмикаються автоматично за датою, green CI або повним обсягом API. **I0 — реалізація чинної S03 policy**, не додатковий Beta gate waiver. **I1–I4 deferred**, незалежні від core Beta workflows.

## 28. Compatibility With S01–S09

| Стратегія | Інваріант                                                                            |
| --------- | ------------------------------------------------------------------------------------ |
| **S01**   | Trainer-first / Athlete Free core автономні від Health                               |
| **S02**   | Не ускладнювати onboarding обов'язковими сторонніми дозволами                        |
| **S03**   | Athlete ownership, JSON/CSV/text export, revocation, deletion, scoped Trainer access |
| **S04**   | Purpose-based lawful processing, vendor/store/contracts і незалежні Legal gates      |
| **S05**   | Server authority, least privilege, IDOR, token protection, risky export audit        |
| **S06**   | Offline safety, idempotency, lost-response recovery, native device QA                |
| **S07**   | External event ≠ authoritative completed workout/W4                                  |
| **S08**   | Немає обов'язкових Health integrations до початкової Beta                            |
| **S09**   | Provider costs, budget caps, verified benefit і controlled rollout                   |

У погоджених 25 рішеннях не виявлено змістових суперечностей із S01–S09. Це **не** підтверджує, що ці контроли вже реалізовані.

## 29. Existing GitHub Ownership

| Issue                                                         | Пов'язаний напрям                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| [#297](https://github.com/sauron9521/gym-platform/issues/297) | User settings, units/privacy/preferences                     |
| [#354](https://github.com/sauron9521/gym-platform/issues/354) | Modular API / product boundaries                             |
| [#356](https://github.com/sauron9521/gym-platform/issues/356) | Shared packages, cross-platform contracts                    |
| [#318](https://github.com/sauron9521/gym-platform/issues/318) | Mobile reliability                                           |
| [#322](https://github.com/sauron9521/gym-platform/issues/322) | Offline sync                                                 |
| [#323](https://github.com/sauron9521/gym-platform/issues/323) | Native builds/tests                                          |
| [#324](https://github.com/sauron9521/gym-platform/issues/324) | Native interrupted operations                                |
| [#352](https://github.com/sauron9521/gym-platform/issues/352) | Beta readiness GO/NO-GO                                      |
| [#375](https://github.com/sauron9521/gym-platform/issues/375) | Adjacent AI privacy ADR, **not Health implementation owner** |
| [#550](https://github.com/sauron9521/gym-platform/issues/550) | Business Governance                                          |
| [#560](https://github.com/sauron9521/gym-platform/issues/560) | Operational go-live gates                                    |
| [#588](https://github.com/sauron9521/gym-platform/issues/588) | Strategic Roadmap                                            |
| [#353](https://github.com/sauron9521/gym-platform/issues/353) | Technical Roadmap                                            |

**Potential backlog gaps to verify after S12:** actual protected export delivery, HealthKit/Health Connect adapters, integration permission lifecycle, provenance/mapping, dedup/reconciliation, partner API policy. Не створювати дублікати без audit реального main, Issues та completed PR.

## 30. Risk Register

| Ризик                                   | Рівень      | Контроль                                  |
| --------------------------------------- | ----------- | ----------------------------------------- |
| Unauthorized Health sharing             | Critical    | Scope + relationship + server authority   |
| Trainer reads private imported data     | Critical    | Athlete sharing permission and revocation |
| External overwrite of completed workout | Critical    | OVRANTO workout source of truth           |
| Duplicate imported sessions             | High        | Idempotency/dedup                         |
| Looping Health sync                     | High        | Provenance/origin                         |
| Deleted-data resurrection               | Critical    | Tombstone, recovery tests                 |
| Revoked credential reuse                | Critical    | Permission recheck/invalidation           |
| Units/timezone/DST mapping errors       | High        | Versioned mapping                         |
| Inflated W4 via imports                 | High        | S07 confirmed domain events               |
| Provider outages/policy changes         | Medium/High | Optional integration/degrade safely       |
| Provider/store policy breach            | Critical    | Terms/legal/API review                    |
| Excessive sensitive data                | Critical    | Narrow metadata scope                     |
| Hidden integration costs                | High        | S09 budget and observed use               |
| Premature public API                    | High        | Separate business/security gate           |
| Native QA gaps                          | High        | Device-level release checklist            |
| Solo-owner maintenance burden           | Medium      | Controlled scopes, deferred vendors       |

Це **потенційні**, а не підтверджені інциденти.

## 31. Remaining Operational & Technical Decisions

**Health/UX:** перша ОС на основі попиту/готовності; exact platform data types; UX import preview/conflicts; local vs server data persistence per use case; Athlete→Trainer optional sharing grants.

**Sync/contracts:** external identifiers/provenance, missing-field mapping, cross-provider dedup, retry/checkpoint rules, import window, disconnect/deletion behavior, можливий future promote-to-workout за окремим domain approval.

**Export/privacy:** JSON/CSV schema versions, expiry temporary files, lawful fallback, integration privacy settings, platform disclosures, vendor processing obligations.

**Future providers:** реальна потреба Garmin/Strava, партнерські ліцензійні умови, native watch-app value, public API security model.

**Cost/operations:** integration caps, observed API/support costs, observability thresholds, device QA matrix, staged rollout/rollback, support capacity, owner GO.

Відкриті **implementation/design parameters**, не приховане схвалення нових Health data categories, fees чи launch.

## 32. Owner Approval, Publication & Change Control

Власник **2026-11-22 явно затвердив S10** після надання всіх 25 відповідей і повного S10 v0.1 OWNER REVIEW без правок. Ця v1.0 зберігає погоджені політики; не затверджує production інтеграції, конкретні API/data field maps або legal/financial commitments.

1. Один docs-only PR із S10 v1.0 та двома docs indexes; перевірка CI/format та відсутності code/DB/Issues змін.
2. **Owner manual review & merge**; assistant **не зливає**.
3. Після merge перевірити canonical S10 у main і відзначити [#588](https://github.com/sauron9521/gym-platform/issues/588) **APPROVED + RECORDED**.
4. **Implementation backlog audit після S12**, жодних імплементаційних змін зараз.
5. **S11 NOT_STARTED** до явної окремої owner-команди.
6. Майбутні зміни — versioned policy revision, S01–S09 impact review, explicit owner approval; зовнішні data/launch gates залишаються окремими.

**S01–S09 APPROVED + RECORDED; S10 OWNER APPROVED / RECORDING PENDING owner manual merge; S11–S12 NOT_STARTED. Health integrations не дозволені для implementation/release без окремих gates; S04/S05/S06 NO-GO до реальних evidence та owner GO.**
