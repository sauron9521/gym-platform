# Mobile development track

Audit baseline: `c2be69c` (2026-11-25). This track changes only `apps/mobile`.
Each PR targets main independently, is reviewed and merged by the owner in order,
and is refreshed against main before final CI. Existing issues remain canonical.

## Baseline findings

- Expo 58 / RN 0.88.1; Expo Router, TanStack Query and typed API client are already present.
- Workout read-only reconciliation exists, but #324 still requires Android/iOS staging evidence.
- The online manager starts an async snapshot and subscribes to live events; a late
  snapshot can overwrite a newer event. Cover this ordering with regression tests.
- Sign-in recovery uses an imperative lock but does not reflect recovery pending
  in the disabled controls or handle rejected recovery promises.
- Auth errors and native stack titles still mix Ukrainian and English (#327).
- The tab layout uses Home / Workouts / Programs / Profile, emoji icons and legacy
  title; compare with the approved athlete navigation before changing routes (#385).
- The theme adapter and Gluestack provider are dark-only (#391).
- The offline draft schema is storage-neutral; no persisted workout draft adapter
  is implemented. Do not persist private data in unencrypted AsyncStorage (#345).
- AuthProvider is 413 lines at this baseline. Extract only after lifecycle tests.
- Native release profiles and Maestro scripts exist; JavaScript export is not native QA.

## Ordered PR queue

| Order | Scope                                                          | Existing issue / gate                           |
| ----- | -------------------------------------------------------------- | ----------------------------------------------- |
| M01   | Audit, mobile-only scope, queue and acceptance criteria        | #318, #385                                      |
| M02   | Network snapshot vs live listener ordering                     | #324                                            |
| M03   | Visible sign-in recovery pending state and failure handling    | #318, #327                                      |
| M04   | Auth error codes and locale-aware presentation                 | #327                                            |
| M05   | Native staging evidence and lifecycle regression coverage      | #324, #348, #385                                |
| M06   | Athlete tab navigation, branding and route compatibility       | #368, #385                                      |
| M07   | Active workout feedback, safe area, keyboard and accessibility | #385, #392                                      |
| M08   | Theme adapter and screen-by-screen light/dark parity           | #391                                            |
| M09   | Workout and auth component extraction with unchanged behavior  | #318                                            |
| M10   | Account-scoped encrypted draft persistence and explicit review | #345                                            |
| M11   | Calendar using existing GET contracts and bounded pagination   | #340                                            |
| M12   | Native crash monitoring with redaction and preview validation  | #350                                            |
| M13   | Inbox, preferences, then local reminders and push              | #574, #577, #342, #343; backend contracts first |

## Merge and release rules

- No API, shared packages, Web, Admin, Trainer or Landing changes in this track.
  Shared dependency or lockfile updates require a separate coordinated decision.
- Each PR must have a focused diff and relevant behavioral tests. Run mobile lint,
  typecheck, contracts and unit tests; native smoke/device evidence as applicable.
- Never retry uncertain workout writes automatically or weaken capability checks.
- Keep #324 and native UX/release gates open until dated device evidence exists.
- Defer coordinated SDK upgrade (#854), billing/IAP and trainer-mobile until their
  existing readiness gates. Do not duplicate existing issues.
