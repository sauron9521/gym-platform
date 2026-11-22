# OVRANTO — S02 Customer Experience & Retention v1.0

**Статус рішення: APPROVED — затверджено власником 2026-11-22 без змін.**  
**Дата:** 2026-11-22.  
**Власник рішення:** засновник OVRANTO.  
**Підстава:** 26 відповідей S02 + 7 явних уточнень; власник прямо затвердив фінальну редакцію S02 v1.0 **без змін**. **S01 Product Strategy v1.0 APPROVED + RECORDED** залишається незмінною.  
**Стратегічна карта:** [#588](https://github.com/sauron9521/gym-platform/issues/588) · **Технічний roadmap:** [#353](https://github.com/sauron9521/gym-platform/issues/353). **Документація набуде чинності в `main` лише після ручного merge документаційного PR власником.**

> **Межа затвердження:** цей документ не відкриває доступу до Trainer API до схвалення заявки, не гарантує фактичну готовність мобільних збірок, не дозволяє зберігати персональні дані без прав/згоди та не запускає нові підписки або платні функції. Затверджена архітектура Notifications #563 залишається чинною: відкладання конкретних користувацьких нагадувань не є скасуванням спільного Inbox/Outbox, налаштувань і каналів доставки.

## 1. UX product thesis

**OVRANTO should get a coach from sign-up to an assigned program, and an athlete from opening a workout to a trustworthy saved result, in as few steps as practical.** Retention derives from real training progress, successful program execution, an ongoing coach–athlete relationship, and timely contextual feedback — **not** compulsive app opens, win-back pushes, social gamification, or artificial daily streaks.

Non-negotiable, inherited S01: Trainer-first, UA then international, UA+EN, phone-responsive full Trainer Web and Athlete Mobile, free closed Beta, no subscriptions/charges during Beta, separately measured **Trainer W4 ≥50% AND Athlete W4 ≥50%**, authentic actual sets and durable offline safety, no Athlete Pro paywall for trainer-assigned workouts or basic coach feedback. Approved Design System v2 and 4-tab Athlete Mobile IA remain unchanged.

## 2. Trainer onboarding and first value

1. New coach gets a **short onboarding** with contextual guidance, not a long compulsory form.
2. First proposed action: **Create your first program**. Offer **blank program OR reusable starter template**, not a mandated template path.
3. During TrainerApplication **PENDING**, owner approves **only an isolated private draft capability**. This **must not imply TRAINER permission**, access to real athlete lists/data, publishing, assigning, inviting clients or elevated API methods. Implementation can propose a user-owned draft permission with server enforcement or genuinely local draft; exact mechanism requires a security/contract review before code.
4. After verified approval: explicit **Draft → Preview → Publish → Assign** flow; draft saving never auto-publishes, and publishing never auto-assigns. Preserve versioning, unsaved-change/leave guard and confirmation of privileged changes.
5. Trainer invites an athlete through a **shareable secure link** or a **QR code encoding the exact same invitation URL**. No parallel QR credentials, direct role grant or unauthenticated client-data disclosure.
6. First value for coach: **a real assigned program** (matching S01 activation), followed by reading actual results and providing feedback. Counting account creation alone is not activation.

### Secure invitation UX

- The link/token is **time-limited, revocable and validated server-side**, bound to the initiating authorized coach/allowed relationship and correct recipient account on acceptance; no enumeration, replay-triggered duplicate relationships or PII leakage in URL preview.
- Expired/used/revoked link has a helpful actionable screen (request a new invitation); accept/sign-in/register should preserve safe navigation context.
- Exact default expiry length, one-time/multi-use behavior and email verification gate are **implementation/security-policy questions**, not invented S02 approval details.

## 3. Two Athlete onboarding paths

**Coached athlete:** open invitation link/QR → see inviting coach name and safe summary → sign up/sign in → accept relationship/see assigned program → start workout → log **actual** results → complete and understand local/server save → view progress/coach feedback.

**Independent athlete:** sign up/sign in → **immediately create/start their own workout** → log actual sets → complete → view history/strength progress. No trainer, detailed fitness questionnaire, paid subscription or compulsory predefined workout plan needed for first value.

**Athlete Mobile IA** keeps existing approved four tabs: Головна / Тренування / Прогрес / Профіль, with accessible native navigation and Light/Dark.

## 4. Trainer daily experience

**Trainer Dashboard** prioritizes:
- clients and quick access to client detail;
- actionable coach tasks, including completed sessions awaiting review;
- programs, drafts, assignment state, templates;
- 3–4 real data-backed overview measures with drilldown, not fake/vanity KPIs.

**Priority phone fast-actions** explicitly selected by owner: (a) view clients/profiles; (b) assign an existing program quickly; (c) review athlete completed sessions; (d) leave workout feedback; (e) invite clients; (f) view client progress/stats.

**Clarification approved by owner:** full **program create/edit remains functional at phone width**, in addition to the six optimized fast actions; desktop may have a richer three-pane editor with safe responsive collapse. This preserves S01, #386 and #365. Mobile cannot be a read-only trainer portal.

**Inactive athletes:** allow **coach-configurable thresholds in days/weeks**, with neutral private status/filter. Avoid penalizing a planned lighter week, a workout frequency below daily, an athlete without a schedule or an athlete with valid unavailable data. **No automatically generated athlete re-engagement message** from the inactivity rule. Exact default threshold and whether per-trainer or per-client overrides exist remain a later UX/settings specification, without blocking this directional S02 strategy.

## 5. Coach feedback — deliberately simplified MVP

Фінальне рішення власника **звужує MVP** до одного обов'язкового формату, а решту переносить на час після MVP:

**MVP/Beta:** a **plain text comment attached to a completed workout as a whole**, authored by an authorized active coach and readable by the relevant athlete under Athlete Free. This is structured workout feedback, not an unrestricted messenger. Preserve ownership, relationship scoping, auditability and later privacy policy.

**AFTER MVP**, if validated by real demand: (1) comments on individual exercises/sets; (2) separate next-workout recommendations; (3) flag asking for a program adjustment; (4) quick reaction/rating. Do **not** interpret a comment as an automatic program mutation/publish/assign.

## 6. Athlete workout UX

**Home:** emphasize **next assigned workout** or **quick start for self-guided** athletes, not a chart-heavy home.

**Active workout:** use the owner-approved compact per-set row (number, **actual** weight, **actual** repetitions, state/confirmation) with accessible touch targets, truthful async feedback and a repeat-tap lock.

**Plan vs fact:** planned weights/repetitions are merely hints. Only explicitly recorded/confirmed **actual completed sets** populate workout results, history and export. Never present an unconfirmed default as completed work.

**Completion:** a concise but informative view of exercises, actual sets/repetitions/weight, basic progress and **truthful save status**. No fabricated metrics; allow return to history.

**Resume:** when reopening a partially completed session show a prominent **Continue workout** action, restoring safely persisted actual state and context. Do not silently restart, discard draft or replay ambiguous writes.

### Saved/sync states

Owner selected:
1. **Saved locally, waiting for sync**;
2. **Syncing**;
3. **Saved and confirmed by server**;
4. **Revision conflict requiring user action**.

**Additional clarification approved by owner:** also show **Save/sync failed — action required** with a safe non-destructive recovery path. An offline/local pending icon must never look like a server-confirmed tick. Unknown PATCH outcomes require authoritative read-only reconciliation, not a blind retry; preserve draft on app restart/account changes without leaking to another account.

**Basic progress for Athlete Free:** recent training history, consistency/regularity and progress in actual working weights. Premium deeper analytics remain for a future product/billing decision, without removing S01's basic-history rights.

## 7. Retention policy and notifications

**Three core reasons to return:**
1. Visible actual training history and progress.
2. Regular execution of the coach's program (or own chosen workout path).
3. Workout calendar and next scheduled session.

**Затверджені S02 події для користувацького досвіду з дотриманням Notifications #563 permission/channel policy:**
- coach assigned a new program;
- coach changed/replaced an assignment;
- coach added workout-level feedback;
- athlete completed a session (for the authorized coach);
- invitation/coach-athlete relationship status changed;
- actionable sync problem (user who can resolve it);
- optional weekly progress summary **post-MVP only**.

**Затверджене уточнення:** **тижневі підсумки та користувацькі нагадування про заплановане тренування відкладаються на час ПІСЛЯ MVP**. Earlier owner-selected event types (new assignment, changes, completed workouts, relationship and actionable sync state, coach feedback) remain in MVP scope where practical/authorized. Do not delete or invalidate the **already approved Notifications #563 architectural foundation**, which specifies Inbox, Push, Local Reminders, Email, preferences, quiet hours and consent; instead treat optional workout reminders / weekly digest as **post-MVP user-facing behaviors** and avoid forced activation during Beta. Existing architecture does not mean these behaviors are live.

**No automatic inactivity win-back:** do not send 'you have not trained' / unsolicited reactivation campaigns after breaks. Coach's private inactivity status is not a marketing trigger.

**Consent and frequency:** nonessential retention messages are **opt-in**, adjustable, suppressible and subject to approved per-channel/quiet-hours policy. Critical security/account messages remain governed by separate security policy. Notification event recipients and record visibility remain server-authorized.

## 8. Support and closed-Beta research

**MVP support UX:** contextual hints on complex actions; short FAQ; **Report a problem** from the current screen; accessible **support email** and **support request form**. Avoid leaking account tokens, raw private athlete data or secrets in automatically attached diagnostics; consent and data minimization apply.

**Beta qualitative method:** interviews with actual coaches/athletes + a simple feedback/problem report form. No compulsory weekly questionnaire.

**No extra fee/plan** in Beta; any post-Beta monetization requires separate explicit voluntary user action under S01.

## 9. Metrics and success

**Locked S01 primary criteria (unchanged):**
- **Trainer W4 Retention ≥50%**, among eligible activated trainers, days 22–28 after first real program assignment;
- **Athlete W4 Retention ≥50%**, among eligible activated athletes, days 22–28 after first actual completed session.

Use **separate numerators/denominators**, include only eligible 28-day cohorts, identify small sample limitations (Beta 5–10 coaches), and do not infer retention from app opens.

**S02 supporting measures (without hardcoded numerical thresholds):**
- trainer onboarding and assignment activation;
- athlete first session activation;
- time/steps to first useful action;
- secure invite accepted → actual first workout;
- assignment → first actual workout;
- started → confirmed completed session;
- workout draft recovery, local/server sync success/failure/conflict and data-loss incidents;
- coarse funnel dropoffs and qualitative causes from interviews.

The detailed event taxonomy, consent/analytics data processing, report ownership and experiments are **S03/S07**, not a new tracking warehouse under S02. E21 billing churn #535 is separate.

## 10. MVP / Post-MVP acceptance boundaries

| Product area | MVP/Beta | After MVP |
| --- | --- | --- |
| Trainer onboarding | short wizard/context help, private drafts while pending, full capability after approval | advanced onboarding personalization |
| Program creation | blank/template, Draft→Preview→Publish→Assign, desktop and phone | advanced builder conveniences |
| Athlete invitation | secure link + QR of same invitation | bulk invitations and richer methods |
| Trainer overview | clients and actual work, responsive fast actions | advanced customizable dashboards |
| Coach feedback | **one text comment on completed workout** | exercise/set comments, recommendations, adjustment flags, reactions |
| Athlete workouts | compact actual sets, planned hint, completion, resume, offline/save/failure/conflict UX | expanded workout presentation |
| Progress | basic strength and regularity | premium detailed analytics |
| Inactivity status | customizable private trainer thresholds; no athlete win-back notifications | optional richer scheduling/filter controls |
| Notifications | core event notification requirements on existing #563 architecture, opt-in nonessential delivery | **weekly progress summary & scheduled workout reminder UX**, other nurture |
| Help | contextual help, FAQ, report bug, email and contact form | knowledge base expansion |
| Beta evaluation | interviews, feedback form, activation/reliability/W4 evidence | broader quantitative experiments |

**Non-negotiable regardless of MVP phasing:** S01 data integrity, security access controls, beta zero payment, and real native device evidence. The strategy is **not evidence that any item is implemented**.

## 11. Risk register and existing delivery owners

- **Pending Trainer draft privilege leakage:** explicit user-owned isolated draft policy, no Trainer capabilities until approval — #286/#291/#309–311/#355, design in #386.
- **Program builder vs small screen:** S01 mandates create/edit on phone; 3-pane desktop editor must responsively collapse without capability loss — #386/#365.
- **False save success, unsafe retries or lost sets:** honest state; actual-device validation; read-only reconciliation after ambiguous PATCH — #385/#318/#324/#322/#344–349.
- **Invitation QR token or role abuse:** secure expiring/revocable URL and server-bound coach/athlete permissions, no duplicate relationship model — #286 plus existing auth API.
- **Scope creep of feedback:** only workout-level text in MVP, avoid new chat domain — #339/#366.
- **Inactivity stigma/misclassification:** opt-in coach-configured days/weeks and schedule context; no automatic athlete reactivation — #321 and Trainer UX.
- **Conflict with Notifications architecture:** product sequencing only, not a rewrite of technical #563/#565/#566/#571/#321; ensure no duplicate delivery subsystem or unintended push.
- **Privacy or noisy telemetry:** role-scoped metrics with minimized data, S03/S07 governance — #352/#554, billing analytics #535 separate.
- **Design parity:** preserve approved Design System v2, athlete four tabs, mobile set row, both themes, accessible feedback patterns — #381/#382/#383/#385/#386/#389.

**Do not create duplicate technical epics/Issues/PRs until S02 is owner approved** and main/open PR status rechecked for each actual gap.

## 12. Decisions deliberately outside S02 signoff

The following do **not** block approval of the strategic UX direction:
- Exact trainer inactivity default threshold value, per-client overrides and business interpretation of holidays/missed sessions.
- Invite token expiry numeric duration, one-time/multi-use detail and revocation mechanics — security/API specification.
- Specific pending-draft persistence schema and permission policy — security-reviewed engineering contract.
- Detailed copy, per-view mockups, interaction timings and native UI QA cases — design implementation.
- Future coach reaction formats, exact weekly summary cadence, reminder delivery scheduling — **post-MVP** decisions.
- Exact activation event instrumentation/retention/consent schema — S03/S07.
- Any new commercial tariff, AI, marketplace, native Trainer Mobile or data ownership decision — excluded by S01.

**Change control:** S02 v1.0 **APPROVED** рішенням власника від 2026-11-22. Це схвалення UX-стратегії, а не підтвердження реалізації, native QA, готовності Beta чи розгортання production. Кожна майбутня зміна потребує окремого перегляду й версіонування. Документ публікується через один docs-only PR, який власник зливає самостійно. **S03 NOT_STARTED**, до окремої команди не починати.
