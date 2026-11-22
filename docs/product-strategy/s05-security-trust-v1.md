# OVRANTO — S05 Security & Trust v1.0

**Статус рішення: OWNER APPROVED — затверджено власником 2026-11-22 без змін.**
**Дата:** 22.11.2026 · **Напрям:** S05 · **Власник рішення:** засновник OVRANTO.
**Підстава:** 25/25 стратегічних відповідей та 10/10 додаткових уточнень, усі погоджені без змін; окреме явне затвердження фінального S05 v1.0 власником 2026-11-22.
**Затверджені залежності:** S01 Product Strategy & Positioning, S02 Customer Experience & Retention, S03 Privacy & Data Ownership, S04 Legal & Compliance — **APPROVED + RECORDED**.
**Стратегічний roadmap:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353).

> **Межа затвердження:** S05 є погодженою **цільовою політикою безпеки**, а не підтвердженням реалізованих контролів, penetration testing, сертифікації, юридичного допуску або готовності Beta/Production. Документ внесено в окремий docs-only PR для **ручного merge власником**; запис у `main` вважається завершеним лише після цього merge. Поки немає фактичних evidence, застосовні security/release gates залишаються **NO-GO**. **S06 NOT_STARTED.** Жодних нових implementation Issues, змін застосунків чи БД це рішення не санкціонує.

## 1. Стратегічна модель безпеки

OVRANTO використовує **Security by Design + Privacy by Design + Zero Trust authorization**.

Основні принципи:

1. **Deny by default:** кожна операція дозволена тільки за наявності підтверджених прав.
2. **Least privilege:** користувач, тренер або співробітник отримує мінімально необхідні можливості.
3. **Server-side authority:** frontend, mobile-застосунок, JWT claims або локальний кеш не визначають остаточні права.
4. **Defense in depth:** автентифікація, авторизація, криптографія, ізоляція, аудит і моніторинг доповнюють одне одного.
5. **Secure recovery:** відновлення акаунтів, локальних даних і резервних копій не обходить security controls.
6. **Evidence-based releases:** успішні тести й документовані докази є обов'язковими для release gate.
7. **Risk-based investment:** до Beta впроваджуються критичні контролі; enterprise-можливості — за фактичними загрозами.

Першочергова мета — захист реальних спортсменів, тренерів, їхніх даних, авторських матеріалів і адміністративних можливостей.

Для перевірки використовувати застосовні положення [OWASP ASVS 5.0.0](https://asvs.owasp.org/), [OWASP MASVS](https://mas.owasp.org/MASVS/), [OWASP API Security Top 10](https://owasp.org/API-Security/) та [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final). Це контрольні орієнтири, **не заява про сертифікацію**.

## 2. Threat model та межі довіри

**Захищені активи:**

- Акаунти, паролі, passkeys, MFA та recovery credentials.
- Access/refresh tokens та адміністративні сесії.
- Персональна історія тренувань, результати сетів і feedback.
- Приватні тренерські програми, шаблони й авторські матеріали.
- Дозволи Trainer–Athlete та історія їх змін.
- Мобільні офлайн-чернетки й черги синхронізації.
- Експорти, резервні копії та audit records.
- GitHub Actions secrets, deployment credentials і production infrastructure.
- Support/moderation cases та їхні докази.
- Майбутні payment entitlements — тільки після окремих платіжних gates.

**Основні загрози:** BOLA/IDOR між спортсменами або тренерами; вертикальна ескалація ролей через API чи claims; компрометація Admin/Super Admin; доступ колишнього тренера після termination; повторне застосування старих offline mutations; витік токенів або локальних даних; PII в logs/analytics/push; компрометація CI/CD; backup resurrection; зловживання запрошеннями, reset та export; небезпечні тренувальні рекомендації, шахрайство й переслідування.

**Trust boundaries:** Athlete, Trainer, Support, Moderator, Admin, Super Admin, API, PostgreSQL/Prisma, mobile storage, CI/CD та сторонні сервіси. Threat model переглядати після суттєвих архітектурних змін і перед критичними релізами.

## 3. Identity, MFA та recovery

**Відповіді 01, 02, 05; уточнення C01.**

Використовувати одну User identity для екосистеми; привілейований доступ відокремлюється політикою сесій і capabilities, **без дублювання User/Auth**.

**Обов'язкова MFA:** Super Admin, Admin та персонал із привілейованими можливостями. Для Trainer і Athlete MFA спочатку добровільна, крім випадків окремого підвищення ризику.

**Пріоритет методів:**

1. **Passkeys/WebAuthn** — основний рекомендований метод.
2. **TOTP authenticator** — альтернативний метод, який не слід називати phishing-resistant еквівалентом WebAuthn.
3. **Одноразові recovery codes** — захищене резервне відновлення.

Recovery codes одноразові та зберігаються лише в захищеному представленні. Переприв'язка MFA потребує перевірки особи; Support не може просто вимкнути MFA за звичайним зверненням. Зміна факторів і аварійне відновлення аудіюються. Втрата факторів не повинна автоматично призводити до безповоротної втрати акаунта, але recovery не може стати обходом MFA. Для особливо ризикових дій може вимагатися сильніший метод або додатковий контроль.

**Password security:** належний password hashing, перевірка відомих компрометацій, захист від перебору, anti-enumeration і безпечний одноразовий password reset; не вимагати довільної періодичної зміни пароля без підстав.

## 4. Sessions та token lifecycle

**Відповідь 04; уточнення C02.**

**Звичайні користувачі:**

- Access token TTL: **15 хвилин**.
- Session idle TTL: **24 години**.
- Session absolute TTL: **7 днів**.
- Refresh token: **rotation**.
- Примусове відкликання сесії: **обов'язкове**.

**Привілейовані адміністративні сесії:**

- Idle TTL: **15 хвилин**.
- Absolute TTL: **8 годин**.
- Окремий security context, обов'язкова MFA, примусова ревокація та audit.
- Точний admin access-token TTL, session binding і спосіб перенесення MFA-контексту визначити технічно.

Не зберігати довгоживучі credentials у відкритому browser storage. Виявляти повторне використання refresh token, завершувати сесії після компрометації, перевіряти актуальні permissions незалежно від старих claims. Звичайна користувацька сесія не може автоматично отримати адміністративні можливості.

## 5. Step-up authentication

**Відповідь 03; уточнення C03.**

Повторна MFA потрібна для зміни пароля/MFA, привілейованих ролей, критичного recovery, аварійного break-glass, небезпечних або масштабних експортів персональних даних, незворотних адміністративних операцій і захищеного видалення акаунта, коли потрібне підтвердження особи.

**Строк чинності step-up: максимум 5 хвилин.** Особливо ризиковані операції перевіряти окремо, навіть якщо попереднє підтвердження ще чинне. Step-up має бути пов'язаний із конкретною сесією та рівнем автентифікації.

Звичайний авторизований експорт власних даних спортсмена з S03 залишається доступним. Повторна перевірка повинна бути пропорційною ризику, а не довільною перешкодою здійсненню законних прав.

## 6. Authorization, permissions та revocation

**Відповіді 06–08; уточнення C04.**

Модель: **RBAC + Capabilities + Resource Ownership + Relationship Scope + Current Permission State**. Кожна server-side read/write/export/admin операція перевіряє дію, ресурс, поточні дозволи та зв'язок.

- **Athlete:** керує власними результатами, історією й дозволами на sharing.
- **Trainer:** бачить результати призначених ним програм у межах чинного зв'язку та конкретно наданих додаткових дозволів.
- **Former Trainer:** звичайний доступ до персональних результатів припиняється; власні авторські шаблони залишаються захищеними.
- **Support:** бачить лише необхідне для конкретного звернення.
- **Admin/Moderator:** окремі capabilities та аудит.
- **Super Admin:** значні адміністративні права не означають необмеженого повсякденного перегляду приватних тренувань.

**Негайна ревокація:** після termination, suspend, зміни ролі або відкликання дозволу нові захищені операції на сервері перевіряють поточний стан. Застарілий JWT/кеш не продовжує відкликаний доступ. За потреби примусово завершуються сесії, інвалідуються привілейовані контексти та перевіряються версії дозволів.

Уже завантажені зовнішні копії неможливо гарантовано відкликати технічно — подальше використання регулює S04. Історична призначена версія програми залишається доступною спортсмену **read-only** за S03/S04 без права нових призначень або автоматичного запуску workout за старим assignment.

## 7. Web та API security

**Відповіді 12, 13.**

Вимоги: HTTPS/TLS; безпечне перенесення credentials; CORS з явними origins; CSRF-контролі, де застосовно до auth-моделі; Zod validation на відповідних API boundaries; rate limiting; anti-enumeration; object-level та property-level permissions; обмеження payload; захист redirect, URL і file flows; мінімізація даних у помилках; інтеграційні negative-auth тести.

Frontend route guards ніколи не замінюють server-side authorization. Перевірки охоплюють read, create, update, delete, export та адміністративні mutations.

## 8. Mobile security та offline protection

**Відповіді 10, 11; уточнення C05.**

Для Expo iOS/Android:

- OS Secure Storage для довгоживучих credentials.
- **Зашифрована локальна БД** для приватних офлайн-даних.
- Ключі під захистом системних OS-механізмів.
- Account-bound isolation локальних даних.
- Server-side permission revalidation та revision/concurrency checks перед sync.
- Захист від replay старих mutations, безпечне відновлення після restart.
- Контроль сценаріїв втрати пристрою, ключа й перевстановлення.

**Logout із несинхронізованими даними:** попередити користувача, зберегти дозволені дані у захищеному account-bound вигляді, не відкривати іншим акаунтам, дозволити безпечне відновлення власником та повторно перевірити права перед sync.

**Невизначений PATCH / lost response:** жодного автоматичного повторення запису; спочатку read-only reconciliation і перевірка серверної ревізії.

**Видалення акаунта:** старі чернетки/sync jobs не повертають видалені записи. При втраті ключа заборонено обходити шифрування; UX чесно повідомляє про можливу неможливість відновлення локальної копії.

Фактичний Expo/native storage stack потребує окремого технічного й device-level доказу. SecureStore сам собою не доводить шифрування **всієї** локальної БД.

## 9. Cryptography, secrets та data lifecycle

**Відповіді 14–16; уточнення C06.**

TLS, шифрування відповідних storage і backups, захищене керування secrets/keys, мінімальні permissions, документована ротація й ізоляція staging/production. Field-level encryption — за окремою оцінкою загроз і класифікацією даних.

**Категорійний retention schedule:**

- Security audit: цілісність, контроль доступу, визначений строк.
- Diagnostics: мінімізація PII та redaction.
- Exports: короткоживучі файли/посилання, перевірка прав під час download.
- Backups: encryption, обмежений строк, перевірюваний restore.
- Recovery evidence: окрема мета та пропорційне зберігання.
- Incident evidence: контрольований доступ і правова підстава.
- Keys/secrets: lifecycle, versioning, rotation, revocation.

**Числові строки retention не затверджено:** визначити після юридичного review за S03/S04 та технічної оцінки. Після backup restore повторно застосовувати актуальні tombstones і відкликання, тестувати відсутність resurrection видалених даних.

## 10. Security notifications

**Відповідь 09 (A+B+C+D); уточнення C07.**

Категорії: новий/підозрілий вхід; зміна email, пароля або MFA; примусове завершення сесій/захисне блокування; підозрілі спроби входу за безпечної політики оповіщення.

**Критичні події: Email + In-App**, можуть надсилатися поза quiet hours. Звичайні/некритичні події підпорядковуються налаштуванням, антиспаму та чинній архітектурі Notifications #563.

Не включати токени, коди MFA, зайву PII чи приватну історію тренувань. Журналювати постановку в чергу та результат доставки, **не стверджувати гарантоване прочитання**. Security communications не стають маркетинговим opt-in і не дають маркетинговим повідомленням права обходити quiet hours; правову підставу визначати за S04.

## 11. Secure development та GitHub supply chain

**Відповіді 17, 18.**

Risk-based SAST/SCA, secret scanning, dependency triage, auth/authorization regression tests, мінімальні workflow permissions, перевірені/pinned сторонні Actions, protected deployment environments, ізоляція секретів від недовірених PR/forks, branch protection та code review.

Release artifact provenance/signing — за фактичною моделлю загроз. Кожний implementation PR має бути невеликим, із unit/integration/e2e доказами відповідно до ризику; не запускати важкі suites для кожної незначної docs-зміни без підстав.

## 12. Vulnerability management

**Відповідь 19; уточнення C08.**

**P0/Critical:** негайна оцінка, блокування небезпечного релізу, встановлення впливу й exploitability, containment/remediation, ескалація, повторна перевірка перед релізом. Відомі експлуатовані блокувальні P0/Critical не отримують waiver.

**High:** первинний triage **до 1 робочого дня**; зафіксувати exploitability, exposure та вплив; строки виправлення — за ризиком. Тимчасовий виняток лише з документованою оцінкою, compensating controls, власником рішення й датою повторного review.

Severity сканера не завжди тотожна фактичній експлуатації; реальні небезпечні вразливості не можна ігнорувати.

## 13. Incident response та communications

**Відповіді 20, 21.**

Рівні P0–P3:

- **P0:** активна критична компрометація або масовий витік — негайна ескалація.
- **P1:** значущий інцидент — термінове реагування.
- **P2:** обмежений інцидент — контрольований розбір.
- **P3:** низький вплив або аномалія — планова обробка.

Процедура: detection/triage → incident owner → containment/revoke → збереження evidence → оцінка впливу → recovery/integrity check → юридично належні повідомлення → postmortem.

До Beta визначити основного й резервного відповідального, emergency contact і умови зупинки сервісу. Немає автоматичної обіцянки цілодобового SOC чи універсальних 24-годинних повідомлень; строки та канали координувати з S04. Змішані security/reliability інциденти координувати із S06, **не починаючи S06 зараз**.

## 14. Trust & Safety

**Відповіді 22, 23 (A+B+C+D); уточнення C09.**

До закритої Beta в мінімальному працездатному обсязі:

1. **Report:** скарги на тренера, спортсмена чи контент.
2. **Block:** небажані контакти й запрошення.
3. **Appeal:** оскарження обмеження/модерації.
4. **Unsafe advice review:** розгляд потенційно небезпечних тренувальних рекомендацій.

Процедура: **Report → Triage → Evidence Review → Decision → Notification → Appeal → Finalization**. Рішення пропорційні, доступ до доказів мінімально необхідний та аудійований. За обґрунтованим ризиком можливі тимчасове обмеження акаунта, заборона запрошень і відкликання сесій.

Повна автоматизована moderation dashboard, масштабні abuse engines та складні workflows можуть з'явитися пізніше. Критична скарга не може чекати на ці інструменти.

## 15. Invitations, links, media та exports

**Відповідь 13; відповідні гарантії S03/S04.**

**Invitations:** обмежений TTL, revocation, перевірка Trainer capability, чинного зв'язку, захист від повторного використання одноразових токенів і витоків даних.

**Password reset/magic links:** достатня ентропія токена, короткий TTL, одноразовість за сценарієм, захист від логування/URL leakage та інвалідація після використання.

**Exercise media:** MIME/size/content checks, приватні owner permissions, URL safety, lifecycle/orphan cleanup.

**Exports:** повторна server-side перевірка права при створенні та завантаженні; пропорційний step-up для ризикових операцій. Формати S01/S03 не змінено: JSON + copyable text для окремого фактичного workout, JSON + CSV для повної історії.

## 16. Security testing та evidence

**Відповідь 24; уточнення C10.**

До Beta зібрати перевірюваний пакет доказів:

- Threat-model review з актуальними загрозами та контролями.
- Authentication/MFA/recovery позитивні й негативні сценарії.
- BOLA/IDOR, privilege escalation, property-level і multi-coach isolation tests.
- Termination/suspend/role-change revocation tests.
- Admin step-up expiration, bypass, replay tests.
- Web/API credential, validation, rate-limit checks.
- **Реальні Android та iOS device-level тести**.
- Account isolation, logout/relogin, lost response, resume й offline recovery.
- Backup/restore та anti-resurrection rehearsal.
- CI/CD secrets, workflow permissions, protected deployment checks.
- Incident tabletop із результатом.
- Trust & Safety emergency report/block/appeal flow.

Вимагати докази failure modes і негативних сценаріїв, не тільки happy path. Закритий Issue або green CI самі по собі не є доказом native-ready/security-ready стану.

## 17. Незалежні Beta та commercial gates

**Відповідь 25; уточнення C10.**

**S05 Security Gate — default NO-GO.** Для security GO потрібні: відсутність невирішених відомих блокувальних P0/Critical; server-side access/revocation; привілейовані MFA/step-up; mobile/offline isolation та реальні пристрої; перевірені backup/restore, secrets і CI; audit та incident runbook; мінімальний Trust & Safety; документований залишковий ризик; **окремий явний owner signoff**.

Це не замінює незалежні S04 gates:

- **L1 Beta Legal** — допуск безкоштовної Beta.
- **L2 Web Commercial** — юридично й операційно підтверджені реальні Web-платежі.
- **L3 Mobile Store** — застосовні Apple/Google rules, purchase flows та реліз.

Закрита Beta з S01: **5–10 тренерів, 4 тижні, безкоштовно, без карток, paywall, реальних оплат або підписок**. Жоден окремий gate не автоматично дозволяє запуск чи платежі.

## 18. Сумісність із S01–S04

- **S01 Product Strategy:** Trainer-first, Ukraine-first, Athlete Mobile, responsive Trainer Web, безкоштовна Beta й окремі W4-показники без змін. Security gates підтримують, а не замінюють product acceptance.
- **S02 Customer Experience:** короткий onboarding, pending trainer private drafts без передчасних привілеїв, захищені link/QR, feedback, чесні offline/sync статуси та Notifications #563 без змін.
- **S03 Privacy & Data Ownership:** Athlete-controlled доступ, незалежні дозволи для кількох тренерів, припинення coach access, історичний read-only план, export/delete, retention, захищені offline-чернетки та backup anti-resurrection збережено.
- **S04 Legal & Compliance:** юридичний оператор, Terms/Privacy/Trainer Terms UA+EN, окремі Terms acceptance / privacy notice / optional consents, авторська ліцензія тренера, тимчасово adult-only Beta, vendor register і L1/L2/L3 залишаються незалежними.

**Спеціальні гарантії:** припинення співпраці не знищує історію спортсмена та не розкриває шаблони тренера; logout не стирає несинхронізовані результати без попередження; security step-up не повинен довільно блокувати законний експорт/видалення; критичні security notices не відкривають marketing opt-in; security GO не є юридичним GO.

**Стратегічних суперечностей із затвердженими S01–S04 не виявлено.**

## 19. Пріоритети, GitHub ownership та залишкові ризики

**P0 до Beta:** auth/authorization/revocation; Admin MFA/step-up/sessions; security audit, secrets, CI boundaries; mobile offline isolation/device QA; backup restore/anti-resurrection; мінімальний Trust & Safety; incident escalation; evidence-based Security GO/NO-GO.

**P1 до розширення аудиторії:** розширені self-service security controls; глибша автоматизація ASVS/MASVS coverage; mature moderation; vulnerability disclosure; покращена security observability.

**Later за потребою:** Enterprise SSO, повноцінний SOC/on-call, bug bounty, корпоративні сертифікації й B2B security requirements.

**Існуючі implementation owners, без нових дубльованих Epic:**

- Identity/Admin: [#281](https://github.com/sauron9521/gym-platform/issues/281), [#288](https://github.com/sauron9521/gym-platform/issues/288), [#289](https://github.com/sauron9521/gym-platform/issues/289), [#290](https://github.com/sauron9521/gym-platform/issues/290), [#293](https://github.com/sauron9521/gym-platform/issues/293), [#295](https://github.com/sauron9521/gym-platform/issues/295).
- Privacy/Trainer: [#286](https://github.com/sauron9521/gym-platform/issues/286), [#297](https://github.com/sauron9521/gym-platform/issues/297).
- Mobile/Offline: [#322](https://github.com/sauron9521/gym-platform/issues/322), [#324](https://github.com/sauron9521/gym-platform/issues/324), [#349](https://github.com/sauron9521/gym-platform/issues/349), [#350](https://github.com/sauron9521/gym-platform/issues/350).
- Backup/Beta: [#351](https://github.com/sauron9521/gym-platform/issues/351), [#352](https://github.com/sauron9521/gym-platform/issues/352).
- Staff/Trust/Operations: [#550](https://github.com/sauron9521/gym-platform/issues/550), [#552](https://github.com/sauron9521/gym-platform/issues/552), [#554](https://github.com/sauron9521/gym-platform/issues/554), [#556](https://github.com/sauron9521/gym-platform/issues/556), [#559](https://github.com/sauron9521/gym-platform/issues/559), [#560](https://github.com/sauron9521/gym-platform/issues/560).
- Notifications: [#563](https://github.com/sauron9521/gym-platform/issues/563), [#572](https://github.com/sauron9521/gym-platform/issues/572).
- Media security: [#306](https://github.com/sauron9521/gym-platform/issues/306).

**Попередні ризики, до фактичної перевірки:** BOLA/IDOR та privileged account takeover — Critical; revoked permissions після termination — Critical; TOTP phishing fallback, offline leakage/loss, недоставка security alerts, backup resurrection, CI/secrets compromise, затримка реакції на unsafe content — High; реліз без необхідних evidence — Critical. Фактична severity залежить від реальних test findings та deployment exposure.

Зокрема #556/#572 можуть потребувати виділення мінімальних **Beta-P0** acceptance criteria із ширших P1-функцій, а #324/#349/#351/#352 — фактичних native/restore/GO доказів. **Цей docs-only PR не закриває й не змінює implementation Issues автоматично.**

## 20. Відкриті залежності, owner review та change control

**Усі стратегічні питання погоджені:** 25 основних відповідей + 10 уточнень; власник явно затвердив **S05 v1.0 без змін 2026-11-22**. Це не є підтвердженням виконання жодної технічної задачі.

**Реалізаційні/юридичні питання, які залишаються відкритими:**

1. Точний admin access token TTL та прив'язка MFA-контексту.
2. Enrollment/recovery flow для passkeys, TOTP і recovery codes.
3. Перевірений Expo encrypted local database/key lifecycle.
4. Механізм негайної server-side revocation без допустимого bypass.
5. Категорійні retention строки після legal review S03/S04.
6. Delivery/fallback/escalation для критичних security notifications.
7. P0 escalation поза робочим часом і резервний incident owner.
8. Строки triage/appeal/emergency actions для Trust & Safety.
9. Ризикові тригери обов'язкового зовнішнього pentest.
10. Evidence та acceptance proof для кожного Beta security control.

Ці питання **не відкривають заново** 35 погоджених стратегічних відповідей, але залишають відповідні release gates NO-GO, доки необхідні фактичні рішення й докази не отримано.

**Change control:** майбутня зміна S05 потребує окремої версійної редакції (наприклад, v1.1), аналізу впливу на S01–S04 та явного owner signoff. Імплементаційні зміни проходять наявний backlog, один невеликий PR, CI та ручний merge власником.

**Поточний стан:** **OWNER APPROVED v1.0; canonical docs PR PENDING MANUAL MERGE**. Після злиття перевірити `main` і тоді позначити S05 **APPROVED + RECORDED**. **S01–S04 без змін; S06 NOT_STARTED.**
