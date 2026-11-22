# OVRANTO — S11 AI & Smart Coaching Strategy v1.0

**Статус рішення: OWNER APPROVED — явно затверджено власником 2026-11-22 після повного S11 v0.1 OWNER REVIEW.**  
**Напрям:** S11 — AI & Smart Coaching.  
**Підстава:** 25/25 відповідей на стратегічне опитування S11, додаткових побажань немає; окреме «затверджую» після S11 v0.1.  
**Затверджені залежності:** S01–S10 — APPROVED + RECORDED.  
**Стратегічний Roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний Roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа затвердження:** S11 є погодженою **стратегічною політикою AI**, **не** дозволом на підключення SDK, model calls, реальних prompts із персональними даними, AI endpoints, зовнішнього AI provider або production release. A0 AI Readiness [#357](https://github.com/sauron9521/gym-platform/issues/357) — **NO MODEL CALLS**; A1 AI Integration [#358](https://github.com/sauron9521/gym-platform/issues/358) — **DEFERRED / HOLD** до незалежних доказів і явного owner GO. Документ подано в одному **docs-only PR**, статус **RECORDED** настане лише після ручного merge власником та перевірки у main. S04 Legal, S05 Security, S06 Reliability та AI-specific quality/safety gates незалежно залишаються **NO-GO** без фактичних доказів. Implementation backlog audit — після S01–S12. **S12 NOT_STARTED.**

## 1. Strategic Objective

OVRANTO обирає напрям **Human-Centered AI + Privacy by Design + Safety by Design + Evidence-Based Intelligence**.

AI підвищує ефективність Trainer і допомагає Athlete орієнтуватися у тренуваннях, **не замінюючи** живу людину, її відповідальність та authoritative domain rules. AI може пропонувати й формувати чернетки, проте не набуває права автоматичного publish, assignment, прихованих змін workout history або медичних висновків.

Пріоритет: Trainer-first функції → мінімізовані дозволені дані → server/domain validation → expert safety evaluation → human review → controlled rollout після окремого owner GO. Не запускати або рекламувати AI без обґрунтованої користі, provider readiness, legality, фінансових caps і відпрацьованих інцидентних сценаріїв.

## 2. First AI Product

**Рішення 01A.** Перший майбутній AI use case — **AI Program Builder** для створення **структурованої DRAFT-програми**.

Потенційні inputs лише у потрібному дозволеному обсязі: мета, experience level, available days/equipment, duration, актуальна library Exercise IDs, окремо дозволений і обмежений verified workout context.

Модель формує **пропозицію**, а не final published program. Інші сценарії (Progress Insights, Athlete dialog, Adaptive Coaching) відкладені. Перший реліз AI Program Builder не включає auto-publish, auto-assign, непомітне редагування опублікованих програм або completed sets.

## 3. Initial AI Audience

**Рішення 02A.** Майбутній A1 Pilot — **невелика група перевірених Trainer**, після завершення A0 і незалежних quality, legal, privacy, security, cost/release gates.

Цілі pilot: фактична економія часу, коректність структури, кількість правок/відхилень, фізична доцільність, UX, latency, ціна генерації, incident handling. Ні чисельність когорти, ні тривалість пілота зараз не затверджені.

Pilot **не** є автоматичною частиною початкової безкоштовної Beta S01; сам факт стратегічного схвалення не відкриває A1.

## 4. Long-Term AI Product Evolution

**Рішення 03A.** Черговість майбутніх продуктів:

1. **Trainer Assistant** — спершу program draft, згодом дозволені progress summaries і draft feedback.
2. **Athlete Informational Coach** — пояснення вправ, тренувальних принципів і функцій OVRANTO без удавання живого тренера або лікаря.
3. **Adaptive Recommendations** — лише після окремого підвищеного safety review та обмеженого human-controlled approval.

Кожен етап має власну product value, privacy, evaluation, unit-economics та owner release оцінку. Жоден не починається автоматично після попереднього.

## 5. AI Autonomy Policy

**Рішення 04A.** AI має тільки **propose / create DRAFT** authority.

Зміна програми, publish і assignment — окремі дії з відповідною **людською перевіркою та авторизацією**. Model/tool output ніколи не є permission, transaction commit або фактом виконання workout.

AI не може обійти immutable published-version rules, owner/Trainer capabilities чи людські підтвердження. Human review необхідний, але **не достатній** без schema/domain/safety validation.

## 6. Allowed Coaching Context

**Рішення 05A+B+C.** Для обмеженого персоналізованого AI context допускаються, лише коли потрібні конкретному запиту:

- **A:** goals, experience, days/week, equipment і підтверджені structured preferences.
- **B:** чинно дозволені **server-confirmed** workouts/sets та bounded history.
- **C:** confirmed personal records та допустимі aggregate progress metrics.

Не включати без окремого review: діагнози, травми/medical notes, усю історію без межі, чужі Athlete records, фізіологічні дані та HealthKit/Health Connect imports. Future S10 data permission **не означає AI-processing permission**.

## 7. AI Consent & Activation

**Рішення 06A.** AI **OFF by default**; добровільний feature opt-in з поясненням функції, категорій даних, факту/умов зовнішнього provider, ризиків, меж точності, відмови та відключення.

Чітко розділяти feature opt-in, lawful processing basis або consent де він потрібний, resource authorization, Trainer–Athlete sharing та vendor data transfer. Terms acceptance — не blanket AI data grant.

На кожну конкретну операцію перевіряються актуальні права. Revocation/withdrawal припиняють нові запити, а data retention/deletion обробляються за застосовною окремою policy.

## 8. Trainer Assistant Data Access

**Рішення 07A.** AI Trainer Assistant читає персональні дані Athlete тільки при **активному Trainer–Athlete relationship**, конкретному допустимому sharing scope, актуальних server permissions і відсутності revocation.

Авторизація перевіряється **для кожного нового запиту**, а не лише під час початкового enrolment. Старий cached/context snapshot чи queued job не повинен відкривати Trainer дані після втрати прав. Server-side BOLA/IDOR negatives обов'язкові.

Поведінку вже згенерованих summaries/reviews після revocation узгоджувати із S03/S04 retention і user rights; не обіцяти автоматичне видалення всіх правомірних записів без юридичної оцінки.

## 9. Provider Data Processing Policy

**Рішення 08A.** Перед зовнішнім AI processing — **vendor/legal/privacy review**, purpose, processing geography, data categories, retention, deletion, contracts/transfers, provider terms та audited vendor register.

Пріоритет — договірна/технічна політика **не використовувати дані OVRANTO-користувачів для навчання моделей провайдера за замовчуванням**; не вважати це підтвердженим до перевірки конкретного provider/product terms.

Передавати мінімальний scoped context, без необмежених history dumps, секретів чи зайвих PII. Full prompts/private context не логуються без окремого necessity/legal/retention рішення.

## 10. Structured Program Generation Contract

**Рішення 09A.** Майбутній шлях: **provider-independent structured proposal → Zod/schema validation → domain + safety validation → authorized TrainingProgramVersion(DRAFT)**.

Model output не перетворюється безпосередньо на Prisma mutation. Усі program writes відбуваються через чинний domain/application service, transaction, idempotency і ownership checks. Unsupported fields/enums/exercise IDs відхиляються.

Lost response, timeout або повторний запит не створюють partial published state. Точний DTO визначається після A0 review, не цим S11.

## 11. Draft Validation

**Рішення 10A+B+C+D.** Перед прийняттям AI-чернетки:

1. **A — Structure/resource:** валідні й доступні Exercise IDs, належні ownership/capabilities.
2. **B — Training constraints:** equipment, days/week, duration, program structure і взаємна узгодженість.
3. **C — Version/domain:** DRAFT status, immutable published versions, atomicity, validation, race/idempotency/transaction rollback.
4. **D — Safety:** unsafe loads або ризикові поради, брак даних і підстави для refusal/escalation.

**Валідний JSON або успішна доменна валідація не доводять фізичну безпеку**. Expert review та quality/safety gates існують окремо.

## 12. Human Review & Publishing

**Рішення 11A.** Тільки **DRAFT → human preview/edit → explicit publish confirmation → separately authorized assignment**.

Trainer бачить фактичні вправи, weeks/days/sets/reps та обмеження, може відхилити або редагувати результат. AI не надсилає програму спортсмену й не змінює її після затвердження. Publish використовує чинну policy і [#338](https://github.com/sauron9521/gym-platform/issues/338); assignment окремо перевіряє current relationship/capabilities.

## 13. Trainer vs Athlete Authority

**Рішення 12A.** Trainer може переглядати AI draft і призначати його **лише власним поточним Athlete за належних прав**. Independent Athlete у майбутньому може підтверджувати власний дозволений план, але **не отримує Trainer assignment capabilities** та не змінює програми інших людей.

Перший Pilot — Trainer-first; future Athlete AI Builder потребує окремої product/release перевірки.

## 14. Provenance & Versioning

**Рішення 13A.** Задокументувати мінімальний **versioned provenance contract**: source MANUAL/ASSISTED/IMPORTED, provider/model/version, contract/eval version, creation time, review status, human reviewer/edits та відповідний publish decision.

Зберігання повних prompts чи персонального context — **не default**; обсяг має бути обґрунтований S03/S04/S05, data minimization та retention.

Це політика майбутніх contracts, **не наказ зараз створювати AI-specific DB fields** до появи producer.

## 15. Physical Safety & Medical Boundaries

**Рішення 14A.** OVRANTO AI **не ставить діагнози, не призначає лікування, не гарантує фізичну безпечність, не оцінює захворювання й не запускає неперевірені реабілітаційні або adaptive load prescriptions**.

Можливі загальні пояснення тренувальних принципів, відмови від очевидно ризикованих запитів та рекомендація звернутися до належного фахівця, коли це доречно.

S04 немедичне позиціонування зберігається; disclaimer не скасовує реальних safety, liability або regulatory requirements, якщо фактична поведінка продукту зміниться.

## 16. AI Quality Evaluation

**Рішення 15A+B+C+D.** Чотири незалежні класи перевірок:

- **A — Deterministic:** Zod/domain validation, synthetic fixtures, invariants, version compatibility.
- **B — Training Safety:** компетентний expert review релевантності, обсягу/навантаження, unsafe advice, недостатніх даних.
- **C — Security & Privacy:** red-team prompt injection, cross-user data leakage, unauthorized Trainer reads, bypass publication/consent.
- **D — Product Pilot:** accept/edit/reject, safety incidents, failures, latency, cost per generation, qualitative feedback.

Визначити measurement windows, severity і acceptance thresholds **до A1**, не вигадувати їх зараз. Synthetic pass не тотожний real-world safety evidence; модель сама по собі не є єдиним незалежним evaluator.

## 17. Prompt Injection & Excessive Agency

**Рішення 16A.** **Усе model input/output недовірене.** Мінімізувати context та інструменти; за потреби tool calls суворо allowlisted, permission-scoped й server-validated.

Модель не має прямого доступу до Prisma/database, secrets, довільних файлових систем чи непогоджених зовнішніх URL/action calls. Системний prompt не замінює server auth. Захист від prompt injection, malicious structured output, excessive agency, PII exfiltration та cross-user access потрібен у threat model/negative tests.

Перший AI Program Builder може працювати взагалі без model-exposed execution tools.

## 18. Failed & Unsafe AI Responses

**Рішення 17A.** **Fail safely:** за schema/domain/safety failure, provider error, timeout, permission rejection або unexpected output нічого не публікувати/не призначати/не застосовувати автоматично.

Користувачу надавати actionable feedback і можливість безпечного ручного створення/редагування або окремого повторного запиту. Визначити feedback/reporting, severity triage, incident response і kill switch. Retries мають враховувати provider billable usage, idempotency, lost response і side-effect isolation.

## 19. AI Architecture

**Рішення 18A.** **Один NestJS modular monolith + майбутній AiModule, provider adapter, versioned typed contracts, scoped application services.**

Auth/relationship service перевіряє актуальні доступи; Workout/Program modules зберігають authoritative facts і program invariants; coaching context — bounded read projection; майбутній AiModule — orchestration; окремий validator/safety layer — контроль output; human UI — review/publish workflow.

**A0** не вводить runtime model calls, SDK, keys, prompt endpoints, embeddings, vector DB, Kafka, окремі БД або обов'язкові AI-мікросервіси. Точний module/package дизайн — після доказового backlog audit.

## 20. Model & Provider Selection

**Рішення 19A.** **Конкретна модель/провайдер не затверджені.** Обирати перед дозволеним A1 після порівняння privacy/vendor terms, no-training guarantees, retention, quality/safety evals, latency, availability, cost, location, support та vendor lock-in.

Cloud, self-hosted або hybrid — допустимі кандидати, не безумовна обіцянка чи необхідність. Provider-independent contracts дозволяють змінювати runtime реалізацію без обходу domain validation.

Не вибирати provider за одним demo prompt або маркетинговими заявами.

## 21. AI Usage & Cost Governance

**Рішення 20A.** Потрібні **usage metering, real cost per generation, per-user/role usage limits, global budget caps, alerts, circuit breaker** та контроль повторів, storage, support й owner time.

Числові ліміти, pricing і конкретний бюджет — **невизначені до actual cost baseline та owner approval**. AI outage або budget exhausted не повинні блокувати Workout core flows чи створювати synthetic Billing revenue.

Сегментувати real measured expenses та scenario assumptions відповідно до S09.

## 22. AI Monetization

**Рішення 21A.** **Не затверджувати зараз AI prices/entitlements.** Питання AI у Trainer paid, Athlete Pro, Free quota, add-on/credits та cost recovery — майбутні окремі рішення через [#497](https://github.com/sauron9521/gym-platform/issues/497), Billing і legal/commercial gates.

Зберігаються S01/S09: один майбутній Trainer paid, один Athlete Pro, Athlete Free core й повністю free initial Beta. AI стратегія не створює третій тариф або право на payments.

## 23. AI Readiness vs Future Integration

**Рішення 22A.** Встановити жорстку межу:

**A0 — [AI Readiness #357](https://github.com/sauron9521/gym-platform/issues/357):** privacy/authority ADR, goals/preferences, minimized scoped coaching context, provider-independent structured draft validator, synthetic fixtures, eval/provenance contracts, threat modeling. **NO model calls, SDK, API keys, real prompt transfers, embeddings, runtime AI endpoint, auto-publish.**

**A1 — [AI Integration #358](https://github.com/sauron9521/gym-platform/issues/358):** **DEFERRED / HOLD**. Лише після verified A0 acceptance, legal/privacy/security/safety/UX/cost review, controlled pilot plan і **окремого explicit owner GO**.

Approval S11 policy **не є GO для A1**.

## 24. AI Pilot & Production Gates

**Рішення 23A+B+C+D.** Потрібні чотири незалежні набори evidence:

- **A — Legal/Privacy:** purposes, lawful basis, consent де потрібно, notices, vendor terms, data minimization/retention/deletion/transfers.
- **B — Security:** IDOR/BOLA, prompt injection, scoped tools, secrets, auth, exfiltration/abuse tests, audit.
- **C — Quality/Safety:** synthetic and real expert reviews, structured/domain checks, unsafe-output handling, human confirmation, зафіксовані acceptance criteria.
- **D — Operations/Economics:** actual latency/cost, budget caps, monitoring/alerts, fail-safe/rollback/kill switch, support, staged rollout та explicit owner GO.

**Pilot GO** і **production GO** — окремі рішення. Green CI, SDK integration або один вдалий demo не доводять відповідність gates.

## 25. AI Release & Change Governance

**Рішення 24A.** **Feature flags, kill switch, staged rollout, model/prompt/contract/eval versions, owner-approved changes, audit та post-incident review**.

Provider, model або prompt зміни, що можуть вплинути на safety, privacy, quality, cost чи behavior, потребують відповідного re-evaluation, versioned traceability, controlled deployment та можливості rollback.

Вимкнення AI не пошкоджує verified workouts, published programs або manual workouts; solo-owner governance не вводить обов'язкового другого approver без окремого рішення.

## 26. Strategy & Backlog Governance

**Рішення 25A.** Після явного owner approval S11 — **один docs-only PR**, checks, **manual owner merge**, перевірка документа в main і Roadmap #588 → **APPROVED + RECORDED**.

Existing #357/#358 та їхні implementation Issues залишаються без змін. Не створювати duplicate AI Epic чи одразу включати provider SDK/model runtime. **Один evidence-based implementation backlog audit лише після завершення S01–S12**, тоді окремі малі PR за ownership/acceptance.

**S12 NOT_STARTED** до окремої власницької команди.

## 27. Phased AI Roadmap

| Фаза                                   | Мета                                                                            | Gate                                               |
| -------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| **A0 — AI Readiness**                  | Privacy ADR, structured preferences, scoped context, deterministic drafts/evals | Existing #357; **NO model calls**                  |
| **A1 — Trainer Program Builder Pilot** | Limited real-model proposals → validated DRAFT → human review                   | #358 HOLD до незалежного owner GO та gate evidence |
| **A2 — Trainer Assistant**             | Дозволені summaries / draft feedback                                            | Separate feature & data approval                   |
| **A3 — Athlete Informational Coach**   | Немедичні пояснення, навігація, загальні підказки                               | Separate purpose/privacy/safety approval           |
| **A4 — Adaptive Recommendations**      | Обережні індивідуальні пропозиції                                               | Посилений safety validation і human control        |

Жодна фаза не активується автоматично; S11 strategy publication не є launch acceptance або approved provider contract.

## 28. Compatibility With S01–S10

| Стратегія | Незмінний принцип                                                            |
| --------- | ---------------------------------------------------------------------------- |
| **S01**   | Trainer-first, Athlete Free core, AI не замінює людського Trainer            |
| **S02**   | AI добровільний, basic program/workout UX не блокується                      |
| **S03**   | Athlete ownership, private by default, scoped sharing, revocation/retention  |
| **S04**   | Немедичні claims, відповідна legal basis і vendor contracts                  |
| **S05**   | Zero-trust server authority, secrets, step-up/audit, scoped access           |
| **S06**   | Atomicity, lost-response/idempotency, fail-safe recovery, controlled release |
| **S07**   | AI proposal ≠ confirmed workout або W4 metric                                |
| **S08**   | AI не є обов'язковою частиною free Beta або недоведеною marketing claim      |
| **S09**   | Measured cost, scenario economics, spend caps, no invented revenue           |
| **S10**   | Health data не передаються AI автоматично; окремий purpose/data grant        |

Змістових конфліктів між затвердженими owner-відповідями S11 і S01–S10 не виявлено. Це **не** є evidence реалізації контролів або готовності AI.

## 29. Existing GitHub Ownership

| Issue                                                         | Напрям                                      |
| ------------------------------------------------------------- | ------------------------------------------- |
| [#357](https://github.com/sauron9521/gym-platform/issues/357) | A0 AI readiness — **без моделей**           |
| [#358](https://github.com/sauron9521/gym-platform/issues/358) | A1 AI integration — **HOLD**                |
| [#375](https://github.com/sauron9521/gym-platform/issues/375) | AI privacy/consent/authority ADR            |
| [#376](https://github.com/sauron9521/gym-platform/issues/376) | Permission-scoped coaching context          |
| [#377](https://github.com/sauron9521/gym-platform/issues/377) | DRAFT application and validator             |
| [#378](https://github.com/sauron9521/gym-platform/issues/378) | Synthetic fixtures/eval/provenance          |
| [#379](https://github.com/sauron9521/gym-platform/issues/379) | Training preferences/equipment              |
| [#338](https://github.com/sauron9521/gym-platform/issues/338) | Preview and human publish confirm           |
| [#297](https://github.com/sauron9521/gym-platform/issues/297) | Settings and preferences                    |
| [#298](https://github.com/sauron9521/gym-platform/issues/298) | Athlete goals                               |
| [#299](https://github.com/sauron9521/gym-platform/issues/299) | Personal records                            |
| [#300](https://github.com/sauron9521/gym-platform/issues/300) | History / analytics projection              |
| [#380](https://github.com/sauron9521/gym-platform/issues/380) | Product architecture / AI readiness roadmap |
| [#497](https://github.com/sauron9521/gym-platform/issues/497) | Pricing and packaging signoff               |
| [#550](https://github.com/sauron9521/gym-platform/issues/550) | Business governance                         |
| [#588](https://github.com/sauron9521/gym-platform/issues/588) | Strategic roadmap                           |

**Потенційні post-S12 backlog gaps (тільки кандидати на перевірку):** provider selection/evaluation ADR, eval harness, model usage/cost metering, AI-specific consent UX, kill switch, AI incident runbook, pilot cohort management та model/prompt change controls.

Не створювати й не дублювати Issues без звірки актуального main, існуючих PR і фактичних acceptance evidence.

## 30. Risk Register

| Ризик                                   | Рівень        | Контроль                                                  |
| --------------------------------------- | ------------- | --------------------------------------------------------- |
| Небезпечна AI тренувальна порада        | Critical      | Expert safety evaluation, constraints, human confirmation |
| Auto-publish/assignment                 | Critical      | DRAFT-only, explicit publish & separate assignment        |
| Unauthorized Athlete context            | Critical      | Current scoped server relationship authorization          |
| Prompt injection / excessive agency     | High/Critical | Untrusted model I/O, no DB access, allowlisted tools      |
| Provider PII leak/secondary training    | Critical      | Terms/legal review, minimization, contractual no-training |
| Cross-user context mixing               | Critical      | Isolation, IDOR negatives, current authorizations         |
| Reusing revoked permission              | High          | Revocation checks, queued job controls                    |
| Hallucinated Exercise IDs               | High          | Domain validator                                          |
| Unsafe weight/reps/load advice          | Critical      | Constraints, qualified reviewer, refusal                  |
| Missing model/prompt provenance         | High          | Versioned metadata and audit                              |
| Runaway API expense                     | High          | Metering, global spend cap, circuit breaker               |
| Vendor lock-in / silent model change    | Medium/High   | Provider adapters, re-evals, rollback                     |
| AI-generated content marketed as proven | High          | S04/S08 approval and accurate claims                      |
| Solo-owner overload                     | High          | Narrow Pilot, operational gates                           |
| Loss of existing workout/program data   | Critical      | Atomic validation, fail-safe, human confirmation          |

Це потенційні ризики, **не докази реальних інцидентів**.

## 31. Remaining Operational & Technical Decisions

**Pilot/Product:** точний Trainer cohort size, duration, входи/виходи Pilot, supported AI generation scenarios, UX preview/edit і майбутній self-service Athlete Builder.

**Data & Privacy:** coaching context DTO, history window, provider-specific lawful basis and disclosures, prompt retention, revocation/deletion of summaries, provenance persistence.

**Safety & Evaluation:** числові thresholds, експертна методологія, red-team/test cadence, severity matrix, eval dataset governance, block/unblock rules.

**Architecture:** конкретна модель/provider, structured output schema, timeout/retry/rate/circuit breaker values, failover, logging/observability design.

**Economics:** actual per-generation cost, owner budget/usage caps, commercial entitlement decisions через #497, pilot cost exit criteria.

**Governance:** operational owner of AI incidents, re-evaluation rules for model/prompt upgrades, rollout/rollback proof and A1 owner GO.

Ці параметри **не погоджено числово або технічно** через S11 strategy signoff; не заповнювати їх довільними значеннями.

## 32. Owner Approval, Publication & Change Control

Власник **2026-11-22** окремо затвердив **S11 AI & Smart Coaching** після 25/25 відповідей, повного S11 v0.1 OWNER REVIEW і явного «затверджую». Ця v1.0 відтворює зміст обраних стратегічних рішень без затвердження провайдера, тарифів, числових квот, користувацького data transfer або AI-runtime.

1. Один **docs-only PR** з S11 v1.0 і двома docs indexes; CI/format/diff review.
2. **Тільки власник** проводить manual review і merge. Assistant **не merge**.
3. Після фактичного merge — перевірити canonical document у main і Roadmap #588 → **APPROVED + RECORDED**.
4. A0 [#357](https://github.com/sauron9521/gym-platform/issues/357) — **NO MODEL CALLS**; A1 [#358](https://github.com/sauron9521/gym-platform/issues/358) — **DEFERRED / HOLD** до нового явного GO. S04/S05/S06/AI quality gates незалежні.
5. Implementation Issues, DB, app code, CI configs, production secrets — **без змін**; post-S12 backlog audit за чинним планом.
6. **S12 NOT_STARTED** до окремої команди власника.
7. Майбутня policy revision — versioned review із впливом на S01–S10 і новим явним approval.

**S01–S10 APPROVED + RECORDED; S11 OWNER APPROVED / RECORDING PENDING manual owner merge; S12 NOT_STARTED. AI runtime, model calls, provider data transfer і Pilot/production GO не дозволені лише цим документом.**
