# OVRANTO — S06 Production & Reliability v1.0

**Статус рішення: OWNER APPROVED — затверджено власником 2026-11-22 без змін.**  
**Дата:** 22.11.2026 · **Напрям:** S06 · **Власник рішення:** засновник OVRANTO.  
**Підстава:** 25/25 стратегічних відповідей і 10/10 уточнень; окреме явне затвердження S06 v1.0 власником, із вимогою **solo developer / solo production operator без другого approver**.  
**Затверджені залежності:** [S01](s01-product-strategy-v1.md), [S02](s02-customer-experience-v1.md), [S03](s03-privacy-data-ownership-v1.md), [S04](s04-legal-compliance-v1.md), [S05](s05-security-trust-v1.md) — APPROVED + RECORDED.  
**Стратегічний roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа рішення.** S06 затверджує **цільову production-архітектуру та операційну політику**, а не готовність Beta/Production, підтверджену доступність, працездатний PITR чи real-device acceptance. Документ запропоновано в docs-only PR для **ручного merge власником**: статус **RECORDED** настає лише після підтвердження файлу в `main`. Reliability, Security і Legal gates залишаються **NO-GO** до фактичних доказів і окремих GO. Жодних implementation Issues, code/DB змін або deployment це затвердження саме по собі не дозволяє; **S07 NOT_STARTED**.

## 1. Стратегічна мета та принципи

OVRANTO використовує **Reliability by Design, Evidence-Based Operations та Controlled Releases**. Мета — стабільне збереження реальних тренувальних даних, передбачуване відновлення після аварій та безпечні випуски за розумного бюджету й операційної складності.

Принципи:

1. **Data integrity first:** непідтверджені записи не видаються за збережені; дублювання й тихий перезапис фактичних результатів неприпустимі.
2. **Simple infrastructure first:** мінімально достатня інфраструктура, керовані залежності, масштабування на основі вимірів.
3. **Reproducible deployments:** production використовує перевірені immutable artifacts.
4. **Forward-compatible evolution:** зміни PostgreSQL/Prisma й API враховують rollback та підтримувані мобільні версії.
5. **Recovery must be demonstrated:** резервна копія не дорівнює успішному відновленню.
6. **Observable operation:** критичні user journeys мають вимірювані сигнали стану.
7. **Solo-operator governance:** власник одноосібно підтверджує критичні операції без другого обов'язкового approver.
8. **Independent release gates:** Reliability, Security, Legal і фінальний owner GO є різними рішеннями.
9. **Fail safely:** за невизначеності не виконувати небезпечний автоматичний запис, відкат чи очищення.
10. **Evidence before promises:** SLO/RPO/RTO/24×7 capabilities не декларуються як досягнуті без перевірки.

## 2. Джерела рішень — 25 стратегічних відповідей та C01–C10

**01–04:** VPS/containers + managed PostgreSQL за бюджетом; Dev/Staging/Production; solo owner operator; вертикальне масштабування спочатку.  
**05–08:** signed immutable artifacts, контрольований rollout, forward-only Prisma migrations, runtime rollback без автоматичного DB rollback.  
**09–12:** off-host encrypted backup, PITR за можливості, затверджені RPO/RTO, monthly restore drills.  
**13–16:** Availability SLO, API/DB/Mobile/worker observability, виміряні performance baselines, actionable alerts.  
**17–19:** P0–P3 incident process, maintenance/change control, post-deployment acceptance.  
**20–22:** реальні Android/iOS тести, fail-closed offline sync, контрольовані OTA/native releases.  
**23–25:** усі п'ять категорій Beta evidence, незалежні gates, поетапний rollout.

**C01–C10:** solo recovery без другого оператора; бюджетний VPS + managed DB за доцільності; PostgreSQL/durable queues/private-media RPO scope; RTO після real user journeys; незалежний synthetic SLI за rolling 30 днів із включеним maintenance; baseline перед p95 thresholds; два незалежні канали P0/P1 alerts; щонайменше 30 хв post-release observation; mobile runtimeVersion compatibility; versioned evidence manifest і особистий owner GO.

Ці рішення є **затвердженими вимогами політики**, а не підтвердженою конфігурацією.

## 3. Hosting & Infrastructure

- Контейнеризовані API та Web сервіси на VPS.
- **Managed PostgreSQL** за умови відповідності бюджету й recovery objectives.
- Окреме persistent storage для приватних медіа, якщо того потребує архітектура.
- Зашифровані off-host backups, незалежні uptime/synthetic checks, захищене керування secrets.
- Відновлювана інфраструктурна конфігурація, задокументовані DNS/TLS, network rules та операційні доступи.
- Провайдер, регіон, managed services, pricing, VPS size і сукупні витрати визначаються окремо після перевірки RPO/RTO.

Self-hosted PostgreSQL можливий як бюджетна альтернатива **лише** за наявності доведених backup, WAL/PITR або рівноцінного механізму, off-host storage та restore evidence. Низька ціна не виправдовує втрату recovery guarantees.

Capacity: baseline → оптимізація → вертикальне масштабування → горизонтальне за виміряної необхідності. Kubernetes, multi-region active-active та мікросервіси не є Beta-вимогою.

## 4. Environment Architecture

| Середовище | Призначення | Обмеження |
| --- | --- | --- |
| Development | Розробка й локальні тести | Development secrets, test data |
| Staging | Реалістична перевірка релізу | Ізольовані БД/credentials, staging-only fault injection |
| Production | Реальні користувачі | Protected secrets, release approvals, monitoring, backups |

Staging має бути близьким до production за runtime, PostgreSQL/Prisma compatibility, TLS, storage, workers та deployment contracts. Використовувати синтетичні чи належно знеособлені дані; реальні персональні дані не копіюються за замовчуванням.

Ефемерний staging у GitHub Actions перевіряє частину сумісності, але не замінює operator-dependent staging/host/native acceptance.

## 5. Solo-Developer / Owner Operations

Власник OVRANTO на початковому етапі одночасно є **Developer, Release Manager, Production Operator, Infrastructure Administrator та Incident Commander**.

Він одноосібно ухвалює production deployment, rollback, disaster recovery initiation та остаточні GO/NO-GO рішення. **Незалежне підтвердження другої людини не є обов'язковим кроком.**

**Компенсувальні контролі:** protected production environment із явним ручним confirmation; MFA/step-up згідно із S05; audit критичних операцій; versioned release/restore plan; immutable evidence; захищені recovery credentials; fail-safe автоматика; provider support; відновлювані runbooks поза єдиним ПК; заборона production secrets у repo/public artifacts.

**Недоступність власника:** система залишається в останньому безпечному стані або застосовує заздалегідь дозволені вузькі захисні обмеження. Provider support не вважається гарантованим production operator, якщо це не підтверджено умовами послуги. Ризик тривалої недоступності власника документується окремо.

**S05 compatibility dependency:** чинний S05 incident runbook передбачає резервного відповідального/контакт; наявний production-readiness runbook згадує distinct reviewer/on-call. S06 **не скасовує ці вимоги мовчки**. До Beta необхідно погодити технічний fallback/provider escalation або окреме версійне уточнення S05, **не нав'язуючи другого production approver**.

## 6. Release Provenance & Promotion

Цільовий ланцюг: **Protected main → CI → Release Candidate → Immutable/Signed Artifacts → Staging → Verification → Owner GO → Production Promotion**.

- Release прив'язується до точного source commit.
- Runtime та Prisma migration artifacts мають immutable digests.
- Provenance/attestation перевіряються до використання.
- Production не перебудовує окремо вже перевірений кандидат.
- Secrets не вбудовуються в образи.
- Release/version зберігається для staging і production.
- Merge/CI/publish не запускають production автоматично.
- Повторно використовуються чинні Gym Platform GHCR, signed-release та staging workflows.

## 7. Deployment Strategy

Обов'язковий порядок: provenance → staging compatibility → recovery readiness → owner approval → controlled deploy → readiness/health → production smoke → metrics → observation → acceptance.

За підтримки інфраструктури використовувати rollout із мінімізацією перерв; інакше — погоджене maintenance window. Активні workout writes мають безпечну поведінку при переході, а клієнти — чесні failure/recovery states. Успішна команда deploy не означає успішний release.

## 8. Prisma Migration & Runtime Rollback

Використовувати **forward-only expand-and-contract**:

- Review schema changes, locks/backfills та ризиків даних.
- Staging migration на репрезентативному наборі.
- Compatibility checks нового runtime та **попереднього runtime з forward-migrated DB**.
- Destructive schema changes у відокремлених контрольованих релізах.

При помилці: **Stop rollout → assess data compatibility → previous verified runtime (якщо сумісний) → smoke → monitor**.

**Не** виконувати automatic reverse Prisma migration чи database restore як штатний app rollback. Якщо runtime rollback небезпечний — maintenance/safe feature disable/forward fix відповідно до incident plan. Database disaster recovery має окреме рішення та RPO/RTO.

## 9. Data Classes & RPO Scope

RPO охоплює:

1. **PostgreSQL:** авторитетні акаунти, permissions, програми, фактичні тренування та інші durable записи.
2. **Durable queues/outbox:** надійно прийняті події, які повинні пережити збій або відтворитися без дублювання.
3. **Private media:** потрібні для продукту файли й references.

Для кожного класу можливі різні механізми, але відновлений продуктовий стан має залишатися узгодженим. Тимчасові кеші не отримують автоматично такий самий RPO.

**PostgreSQL PITR не відновлює автоматично object storage чи зовнішні черги.** Потрібні snapshot/reconciliation, durable references/events та перевірка узгодженості. Tombstones і revocation evidence S03/S05 повинні запобігати повторній появі видалених даних або відкликаних прав.

## 10. Recovery Objectives

| Метрика | Закрита Beta | Платний production |
| --- | --- | --- |
| **RPO** | **≤ 1 година** | **Ціль ≤ 15 хвилин** |
| **RTO** | **≤ 4 години** | **Ціль ≤ 2 години** |

Це **внутрішні цілі**, не вже доведені service guarantees або публічний SLA.

**RTO completion** настає тільки після перевірки PostgreSQL/critical durable components, API readiness, auth та ключових Trainer/Athlete **read/write** user journeys і цілісності продуктового стану. Самого `/health/live` недостатньо.

Метод вимірювання початку/кінця інциденту й цілі на кожному етапі повинні мати відтворюваний restore proof.

Звичайний offline sync/lost response не отримує дозволу втрачати чи дублювати workout records на підставі disaster-recovery RPO.

## 11. Backups, PITR & Restore Drills

Мінімум: encrypted/off-host backup; контроль доступу/ключів; backup freshness/integrity; WAL/PITR чи доведений еквівалент RPO; приватні media backups; узгодження durable events; **drill до Beta**, далі **щомісяця**, а також після критичних DB/backup змін.

Кожен drill фіксує: джерело, recovery point, час відновлення, компоненти, data integrity, media/queue reconciliation, anti-resurrection, виміряні RPO/RTO, owner і PASS/FAIL.

Restore виконується в ізольованому середовищі без знищення production. **`pg_dump` не прирівнювати до PITR.**

## 12. Availability SLO & Synthetic SLI

- **Beta:** **99,5%**.
- **Paid production:** ціль **99,9%**.
- **Вікно:** **rolling 30 days**.
- **Planned maintenance входить у недоступність**, а не виключається автоматично.

Незалежні HTTP/synthetic checks повинні оцінювати критичні user journeys, не тільки VPS uptime/один health endpoint. Можливі захищені probes API, auth, critical reads і безпечний synthetic workout-write у дозволеному тестовому контексті.

Визначити розрахунок часткових помилок, timeout, missed probes, missing data, weighting критичних маршрутів і метод уникнення забруднення product analytics. Поточні **provisional** monitoring rules не доводять production SLO.

## 13. Performance & Capacity Baseline

До Beta виконати staging load/stress baseline для critical read/write, login/session, Trainer assignments, WorkoutSet updates, offline reconciliation, PostgreSQL connections/latency, workers/queues за наявності.

Зібрати p95, throughput, 5xx, **окремий 429**, CPU/RAM, DB/connection metrics. Установити пороги **за результатами вимірів**, окремо для critical read/write/API; переглядати після Beta. Не нав'язувати один невмотивований p95 для всіх маршрутів. Тестування не повинно створювати ризик реальним користувачам.

## 14. Observability & Telemetry

| Сфера | Базові сигнали |
| --- | --- |
| API | Availability, p95, 5xx, 429, critical write failures, request correlation |
| PostgreSQL | Connections, slow queries, disk, migrations, backup freshness/restore |
| Mobile | Crashes, errors, offline/sync/conflict failures |
| Workers/integrations | Queue lag, retries, dead-letter, email/push delivery, якщо компоненти використовуються |

Не створювати фіктивні production метрики для ще не реалізованих компонентів. Дотримуватись S03/S04/S05 redaction, retention, мінімізації PII та розмежування доступу. Наявні opt-in observability scripts не означають налаштоване й перевірене production alert delivery.

## 15. Alerting for Solo Operations

Для P0/P1 — **два незалежні канали доставки alert власнику**; severity routing, дедуплікація, retries/escalation, перевірка доставки, heartbeat checks, зрозумілий runbook.

Дозволені **заздалегідь перевірені автоматичні fail-safe**: призупинити нові запрошення/onboarding, ризикову інтеграцію чи наступний deploy; вузький read-only режим там, де він справді захищає дані. Заборонені неперевірені destructive rollbacks, database restores або масові deletions.

Два канали **не дорівнюють двом операторам**. Власник залишається єдиним release approver. Жодної недоведеної 24/7 human-response обіцянки.

## 16. Incident Management & Emergency Operations

Єдина із S05 класифікація **P0–P3**. Process: detection → triage → severity → containment → recovery → verification → communications → postmortem.

Власник — початковий Incident Commander. Security/reliability інциденти координуються єдиною хронологією без дублювання. Runbooks повинні охоплювати втрату VPS/PostgreSQL, небезпечні migrations, пошкодження backups, secrets/permissions, масові Mobile sync failures, втрату alert delivery та недоступність власника.

## 17. Maintenance & Change Management

Для планових змін: impact review активних workout sessions, maintenance window, актуальний backup, rollback plan, користувацька комунікація за потреби, preflight, serialized risky changes, release evidence, post-deploy verification та release freeze у визначені ризикові періоди.

Emergency fixes можливі прискорено **без обходу data integrity/security gates**; зберігається audit і post-incident review.

## 18. Post-Deployment Observation & Stop Triggers

**Мінімум 30 хвилин активного спостереження** після production deploy; для high-risk releases — довше за ризиком.

Перевірити API/auth, критичні Trainer/Athlete read/write, PostgreSQL, write failures, Mobile sync-related errors, worker state, critical security alerts і доступність incident channels.

**Stop/rollback triggers:** підтверджені duplicate/lost workouts; несумісна migration; критичний security failure; масовий auth outage; persistent writes failure; неконтрольовані Mobile sync failures; вихід за затверджені release health thresholds.

Точні числові пороги та high-risk observation window визначити за baseline в operational runbook. 30 хв — не доказ відсутності відкладених збоїв.

## 19. Mobile & Offline Reliability

До Beta потрібні **реальні Android + iOS device-level acceptance**: login/refresh; active workout і set completion; interrupted PATCH; server commit з втраченою відповіддю; airplane-mode/reconnect; background/foreground; cold restart; logout/login; account switching; duplicate tap; expired session; **точна server-side кількість mutations**.

Ключові інваріанти:

- Локально збережене ≠ серверно підтверджене.
- Немає silent overwrite й автоматичного replay неоднозначного PATCH.
- **Read-only reconciliation first**.
- Idempotency keys **не замінюють revision/conditional updates**.
- Конфлікт 409 потребує явного вирішення.
- Доступ і дозволи перевіряються заново перед sync.
- Відкликані права/видалені акаунти не воскресають через offline jobs.
- Account-bound encrypted local DB за S05.

Unit/component/Metro/Maestro YAML самі по собі **не є real-device evidence**.

## 20. Mobile Versioning & OTA Compatibility

- Підтримувати поточний і попередній **сумісний** native runtime, де можливо.
- OTA — лише в межах відповідного `runtimeVersion`, після QA, із staging/production isolation.
- Native/SDK changes — тільки через versioned native build та відповідний store/internal distribution rollout.
- Backend зберігає контракт із підтримуваними Mobile versions.
- Моніторинг crash/error та rollback/fallback можливості після update.
- Force-update — тільки при підтвердженому security/compatibility/data-integrity ризику, із захистом unsynced drafts і доступу користувача до даних.

## 21. Reliability Evidence Manifest

Використовувати єдиний **versioned evidence manifest** із посиланнями на:

| Категорія | Evidence |
| --- | --- |
| Release identity | Release ID, source SHA, runtime/migration immutable digests |
| CI | Workflow run IDs, attempts, conclusions, test results |
| Staging | Environment, deployed version, smoke evidence |
| Database | Migration compatibility та two-release rollback rehearsal |
| Recovery | Backup source, isolated restore, виміряні RPO/RTO |
| Mobile | Android/iOS builds, device/OS, native failure matrix |
| SLI | Метод availability, rolling 30-day observations, data freshness |
| Security | S05 independently evidenced GO/NO-GO |
| Legal | S04 L1 independently evidenced GO/NO-GO |
| Operations | Alert delivery, incident/runbooks, solo-operator fallback |
| Owner | Особистий GO/NO-GO, timestamp, release/scope, expiry/evidence context |

Жодних секретів, access tokens, приватних workouts чи зайвих персональних даних у manifest. Невідомий/застарілий/відсутній **обов'язковий** evidence означає **NO-GO**. Автоматичне збирання manifest **не надає owner GO**.

## 22. Independent Launch Gates

**Reliability GO/NO-GO:** immutable signed artifacts, real staging/rollback, safe migrations, restore з доведеними RPO/RTO, observability/alerts, реальний Android+iOS QA, safe offline sync, incident/fallback runbook, відсутність незакритих blocking reliability defects.

**Security GO/NO-GO:** окреме рішення за S05; Reliability не замінює MFA/IDOR чи інші security controls.

**Legal L1 Beta GO/NO-GO:** окремо за S04; paid Web/Mobile потребуватиме також застосовних L2/L3.

**Final Owner GO:** виключно власник OVRANTO явно ухвалює рішення для конкретних release, environment, rollout scope і evidence set. Немає автоматичного GO від зеленого CI, merge чи checklist.

**До виконання застосовних gates — Beta NO-GO.**

## 23. Closed Beta Rollout & Exit Criteria

Перша Beta — **5–10 погоджених тренерів із реальними спортсменами, чотири тижні, безкоштовно**, без карток/платежів/paywall чи автоматичного доступу всім.

Поетапне підключення, контроль workout writes/sync, підтримка, можливість призупинити нові invites/onboarding, явні stop/rollback criteria. Kill switch не знищує локальні drafts і не спричиняє втрату workout data.

Критичний security incident або невирішена втрата тренувань блокують Beta незалежно від бізнесових метрик. **Trainer W4 ≥50% та Athlete W4 ≥50%** залишаються окремими продуктовими порогами, не заміною Reliability Gate. Успішна Beta **не** дозволяє реальні платежі автоматично.

## 24. Priorities — Beta, Paid Production, Later

| Напрям | Beta P0 | Paid production | Later |
| --- | --- | --- | --- |
| Hosting | VPS/managed DB за перевіреним RPO/RTO | Додаткова recovery capacity | Advanced HA |
| Environments | Dev/Staging/Production | Більша automation/parity | Додаткові середовища |
| Releases | Signed artifacts, owner GO, smoke, rollback | Строгіший rollout | Progressive delivery |
| PostgreSQL | Forward migrations + compatibility | Розширені rehearsals | Complex migrations |
| Recovery | RPO ≤1 год, RTO ≤4 год | RPO ≤15 хв, RTO ≤2 год | Multi-region DR |
| Availability | 99,5% rolling 30 days | 99,9% rolling 30 days | Вищі SLO за потребою |
| Monitoring | Critical API/DB/Mobile/worker signals | Повніші SLI та error budgets | Mature SRE |
| Mobile | Real-device/offline proof | Controlled OTA/native rollout | Broad device matrix |
| Operations | Solo owner, runbooks, alerts | Посилені safeguards | Команда/on-call |
| Gates | Reliability + Security + Legal L1 | Відповідні L2/L3 | Enterprise controls |

P0 — **умова до Beta**, а не доказ готовності в `main`.

## 25. Compatibility With S01–S05

- **S01 Product Strategy:** Trainer-first, Україна, безкоштовна чотиритижнева Beta для 5–10 тренерів, Athlete Mobile/Trainer Web, незалежні W4 KPI — без змін.
- **S02 Customer Experience:** pending drafts, чесні save/sync/error states, захищений onboarding, активні workouts і recovery — без змін.
- **S03 Privacy & Data Ownership:** recovery не повертає правомірно видалені дані, відкликані permissions чи чужі offline drafts; telemetry/backup/test data дотримуються privacy policy.
- **S04 Legal & Compliance:** legal operator, Terms/Privacy/Trainer Terms, adult-only Beta, vendor contracts, L1/L2/L3 — незалежні та без змін.
- **S05 Security & Trust:** MFA/step-up, server-side access, encrypted local storage, audit, critical security notices, incident response і Security Gate — без послаблень.

**Явна залежність, а не мовчазна зміна S05:** резервний контакт/відповідальний в S05 та distinct reviewer/on-call у чинних operator docs мають бути погоджені із solo-operator моделлю до Beta. Другий mandatory release approver **не допускається політикою S06**, але конкретний fallback і юридично/технічно обов'язкові ролі перевіряються окремо.

## 26. GitHub Implementation Ownership — defer backlog refactoring

Стратегія **не створює паралельний Reliability Epic**. Наявні task/epic owners:

| Напрям | Наявні Issues |
| --- | --- |
| Mobile session | #318, #324–328 |
| Offline sync | #322, #344–347 |
| Native builds/QA | #323, #348–349 |
| Mobile diagnostics | #350 |
| Staging/restore | #351 |
| Reliability Gate | #352 |
| API observability | #316 |
| Business operations | #550, #560 |
| Roadmaps | #353, #588 |

**Owner decision on sequencing:** завершити S01–S12 стратегічні рішення перед **масовим аудитом, refactoring/reprioritization, закриттям/перенесенням реалізаційних Issues чи створенням нових**. Під час роботи над стратегією збирати тільки non-mutating crosswalk, зафіксовані ризики/залежності та можливі gaps.

**Після S12** (окреме власницьке доручення): інвентаризувати весь backlog і `main`; зіставити з approved стратегічними версіями; закрити доведені дублікати/застарілі задачі, зберігаючи історію; перерозподілити P0 Beta acceptance, milestones та dependencies; нові Issues створювати **тільки для підтверджених прогалин**, не перестворювати все; далі — **один невеликий PR до повного CI/review і ручного merge власником**.

**Потенційні розбіжності для майбутньої звірки:** #352 має P2, #351/#348/#349 та #344–347 мають P1, #316 має P2, але відповідні **мінімальні Beta-P0 evidence slices** є блокувальними. Це прапорці для майбутнього review, **не зміна GitHub Labels/Issues зараз**.

**Safety exception:** якщо до завершення всіх S01–S12 планується реальний Beta launch, обов'язкові Security/Legal/Reliability gates і дефекти втрати даних не можна відкладати лише заради черговості стратегій.

## 27. Risks, Alternatives & Trade-offs

| Ризик | Попередня severity | Контроль |
| --- | --- | --- |
| Втрата/дублювання workout records | Critical | Revisions, idempotency, reconciliation, native evidence |
| Несумісна Prisma migration | Critical | Expand/contract, two-release rehearsal |
| Backup не відновлюється | Critical | Off-host backup + реальний restore |
| Неконсистентний PostgreSQL/media/outbox recovery | Critical | Reconciliation і integrity checks |
| Власник недоступний під час P0 | High | Fail-safe automation, provider support, runbook; залишковий ризик |
| Недосяжні RPO/RTO | High | Measured restore й cost review |
| Хибне SLO через health-only metrics | High | Independent synthetic user-journey probes |
| Пропущені alerts | High | Two independent channels, delivery tests |
| Небезпечний runtime rollback | High | Compatibility proof, stop/forward fix |
| Несумісний OTA/runtimeVersion | High | Runtime binding, QA, rollout |
| Надлишкова інфраструктурна складність | Medium | Capacity baseline, vertical-first |
| Green CI прийнятий за launch GO | Critical | Independent manifest і owner approval |

**Відхилені альтернативи:** Kubernetes/multi-region до Beta без потреби; automatic production deploy after merge; автоматичний DB rollback; same-server backup як єдиний recovery; VPS uptime як єдина availability метрика; публічний rollout без gates; auto-retry ambiguous PATCH; обов'язкова друга людина для production approvals.

**Умовна альтернатива:** managed PaaS може бути кращим за VPS+managed DB, якщо за перевіреним сукупним TCO, security та RPO/RTO він виявиться ефективнішим.

## 28. Open Implementation Decisions

Ці невирішені **технічні/операційні деталі** не переглядають 35 стратегічних відповідей:

1. Hosting provider/region/budget/managed DB та TCO.
2. Сумісний із S05 emergency fallback без другого approver.
3. WAL/PITR, media/object storage, durable queue/outbox і consistency.
4. Фактично виміряні recovery point/time та межі вимірювання.
5. Synthetic SLIs/critical route weighting/rolling-window rules.
6. p95, 5xx/429 та capacity thresholds після staging baseline.
7. Два незалежні alert channels, retries, safe automated actions.
8. Stop thresholds і high-risk post-release observation duration.
9. Mobile supported runtimes, OTA fallback та force-update.
10. Evidence manifest schema, storage, retention, integrity.
11. Cost feasibility відносно recovery objectives.
12. Реальні Android/iOS та backend mutation evidence.

Якщо обраний budget або solo fallback не дозволяють досягти обов'язкових Beta gates, необхідно змінити інфраструктуру/процес або відкласти запуск. Не можна мовчки знизити вимоги чи оголосити GO.

## 29. Approval, Publication & Change Control

**Власник явно затвердив цю S06 v1.0 без змін 2026-11-22**, підтвердивши 25 відповідей та 10 уточнень і власну одноосібну release-authority модель.

Наступні контрольні кроки: один **docs-only PR** із S06 та документаційними індексами; CI; **тільки ручний merge власником**; перевірка документа в `main`; після цього позначити **APPROVED + RECORDED** у #588.

**Implementation Issues не змінювати зараз** — масштабна backlog reconciliation після погодження S01–S12, за окремою командою; не створювати дублікати.

Будь-яка майбутня зміна затвердженої політики потребує версійної редакції (напр., S06 v1.1), аналізу S01–S05 та явного owner signoff.

**S01–S05: APPROVED + RECORDED. S06: OWNER APPROVED / publication pending owner merge. S07: NOT_STARTED. Reliability/Security/Legal gates: NO-GO до фактичних доказів.**
