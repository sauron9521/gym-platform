# OVRANTO — platform audit and delivery reconciliation (2026-11-27)

Status: dated audit and delivery plan; not release acceptance. Source audit:
[814bfdc](https://github.com/sauron9521/gym-platform/commit/814bfdc14bc74799e1b65b5734ef08bf1a9a6041).
Reconciliation baseline:
[4387efa](https://github.com/sauron9521/gym-platform/commit/4387efacd48e04daeae9304fc5eb01b70197b707)
after #998 merged. Master roadmap: [#353](https://github.com/sauron9521/gym-platform/issues/353).
Retain the [Beta evidence matrix](../beta-readiness-gates.md): **NO_GO**.

## Verified observations

- Six applications (API, Athlete Web, Mobile, Trainer Web, Admin, Landing) and six shared packages (api-client, datetime, design-tokens, domain, i18n, ui-web). At the original snapshot: 1,567 tracked application files; 589 test-named files (not test case count or coverage); 17 workflow files.
- Original main [CI](https://github.com/sauron9521/gym-platform/actions/runs/46044899911) and [Web integration](https://github.com/sauron9521/gym-platform/actions/runs/46044899490) passed; all 22 listed CI jobs succeeded. Updated main [CI](https://github.com/sauron9521/gym-platform/actions/runs/46046086001) and [Web integration](https://github.com/sauron9521/gym-platform/actions/runs/46046086065) also passed. These do not prove live release acceptance.
- Local checkout was behind and had six modified generated files; PostgreSQL, Redis and Mailpit were healthy. No listeners on tested app ports 3001–3005; root-cause investigation not performed. Do not reset or overwrite the local checkout.
- Five audience API roots exist. Nine controllers remain in Exercises, Training Programs and Workouts. #998 completes contract preparation ABI06d1; next ABI06d2. Preserve routes, authorization and OpenAPI parity. Final business-core organization remains deferred until ABI08 per #964.
- Prisma schema is split by feature. #963 introduced bounded pool/lifecycle controls; #997 correlates driver timing with HTTP requests. Connection budget and two-replica evidence remain open.
- Notifications have substantial source implementation: #966–981 inbox/outbox, delivery, settings and cross-app shell; #983–987 shared datetime; #988–996 native local-reminder work. Delivery activation, consent, operational recovery and real-device acceptance are separate.
- Trainer Web has workspace, client details, assignment selection and inbox; the program editor is not yet migrated. Athlete Web/Mobile retain legacy trainer surfaces. Admin has user management, authentication and inbox. Landing has localized product routes.
- Only API has a tracked Dockerfile and production Compose runtime/migration services at the audit baseline. Other app hosting can be containerized or separately hosted; decide explicitly and verify full-stack staging. Domain ownership is owner-reported; #994 prepared isolated SMTP, not end-to-end staging acceptance.

## Delivery sequence and existing ownership

Priorities below describe sequencing, not changes to existing global priority labels.
Keep one bounded PR per slice, current-main check, relevant CI and manual owner merge.

| Lane              | Existing ownership                       | Next action and evidence                                                                                                                            |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security          | #948, #290, #288, #293; M01              | Account deletion MFA rollout and Admin step-up policy, replay/negative tests, actual intended composition; separate security signoff                |
| API architecture  | #909, #918–920; M05                      | ABI06d2–d6, then Training Programs and Workouts, ABI07–08; verify contracts and dependency rules; discuss core separately                           |
| Trainer product   | #355, #365–369; M05                      | Complete create/preview/publish/assign, athlete execute, trainer review with real API and negative access tests                                     |
| Shared foundation | #921, #922, #313–316, #356; M03          | Storage port, actual connection budget, SQL/query measurement, shared-package adoption; no speculative scaling                                      |
| Mobile            | #324, #342, #345, #348–349; M04/M06/M07  | Android/iOS signed isolated build; offline/reopen/lost-response/revision and local-reminder checks; exact server write counts                       |
| Notifications     | #563, #565–581                           | Reconcile merged slices against individual acceptance; consent/retry/replay/retention and live SMTP/device evidence; SSE/push follow approved scope |
| Infrastructure    | #393, #351, #923; M02/M07                | Decide Web hosting/packaging, full-stack HTTPS staging, signed release chain, restore and two-replica drill                                         |
| Product UX        | #381, #385, #389, #391–392; M02          | Design System v2, accessibility, native UX and accurate public landing                                                                              |
| Beta              | #323, #352, #556; M07 plus cross-cutting | Collect legal/privacy/security/operational/analytics evidence, then explicit owner GO; no invitations beforehand                                    |

Parallelize nonconflicting lanes, especially Trainer product, security, staging preparation and architecture. Do not wait for speculative architecture perfection to test the critical trainer journey. No microservices, Kubernetes, Kafka, Fastify migration, paid billing, AI model calls or marketplace activation is approved by this audit.

## Milestone reconciliation

At reconciliation, 185 open Issues (excluding PRs); 97 assigned to existing M01–M07, 88 unassigned. Seven milestones are open:

| Milestone                       | Open | Closed |
| ------------------------------- | ---: | -----: |
| M01 Identity and Admin Security |    9 |      2 |
| M02 Brand and UX                |   11 |      2 |
| M03 Core and Shared Packages    |   22 |      0 |
| M04 Athlete Features            |   20 |      0 |
| M05 Trainer and Program Builder |   18 |     15 |
| M06 Mobile and Offline Sync     |   10 |      1 |
| M07 Beta and Release Evidence   |    7 |      0 |

Counts are a pre-update snapshot, not feature completion percentages.
#948 is an unassigned P0 security task that belongs to M01; align its existing metadata with that phase. #854 remains deferred until a supported runtime trigger. Keep cross-cutting Notifications unassigned per #353's 2026-11-26 policy; track them via #563. Do not assign global roadmaps, deferred M08/E18, commercial E21 or governance E22 indiscriminately to active technical phases. Reuse [milestone sync procedure](../development/github-roadmap-milestones.md); no new milestones or deadlines.

## Beta and strategy

All S01–S12 documents exist in main; see [strategy index](../product-strategy/README.md). Historical pending/NOT_STARTED statements in individual approval records are not live status. Reconcile navigation/status separately without rewriting historical decisions.

The free adult-only Ukraine-first Beta remains limited to 5–10 trainers and their athletes, with separate trainer and athlete W4 retention targets of 50% over complete individual observation windows. Legal L1, privacy/security, native QA, critical trainer-to-athlete flow, live HTTPS staging, restore/rollback and alert delivery must meet the existing [gate matrix](../beta-readiness-gates.md). RPO at most one hour and RTO at most four hours are targets, not measured achievements. Define latency/error/429 thresholds using actual staging measurements. Billing, integrations, AI and marketplace remain independently gated.

## Audit limitations

Static review of selected files, repository inventories, public Issues and workflow results; local service status only. No fresh exhaustive test rerun, line-by-line code audit, penetration testing, physical-device acceptance, load measurement, DNS verification or external legal/recovery evidence. Subjective maturity scores are not completion evidence and are not adopted as delivery KPIs. No Issue may be closed simply because a PR merged. This report does not authorize deployment, invitations, commercial activation or policy changes.
