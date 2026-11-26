# ADR-009 pilot evaluation (SM05)

- Reviewed: 2026-11-26, main `c9df89c`.
- Recommendation: retain the mobile rest timer store; conditional, feature-specific adoption only.
- Status: proposed for owner review. No release or broad migration approval.

## Evidence

- [PR #892](https://github.com/sauron9521/gym-platform/pull/892) merged: account-scoped vanilla Zustand store, runtime above navigation, preserved manual controls and authoritative set confirmation.
- [PR #893](https://github.com/sauron9521/gym-platform/pull/893) merged: timer lifecycle regressions, selector isolation and stale asynchronous feedback guard.
- GitHub Actions for #892: [CI](https://github.com/sauron9521/gym-platform/actions/runs/45778287326), [Web integration](https://github.com/sauron9521/gym-platform/actions/runs/45778287292), both successful.
- GitHub Actions for #893: [CI](https://github.com/sauron9521/gym-platform/actions/runs/45779270537), [Web integration](https://github.com/sauron9521/gym-platform/actions/runs/45779270661), both successful.
- Reported local validation at #893: 308 unit tests, 150 contract tests, including 15 focused timer/feedback tests; typecheck and lint passed. This is prior automated evidence, not a fresh native device run.

| Criterion              | Assessment                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Shared lifetime        | Screen remount retains the timer; runtime continues without a visible timer.                              |
| Ownership              | Removed screen-local rest-start event; one store owns countdown and deadline, not server workout records. |
| Subscription isolation | Scope-only consumer does not render on countdown ticks in the regression test.                            |
| Testability            | Vanilla store actions tested without navigation or an API; runtime and feedback tested separately.        |
| Lifecycle safety       | Account/workout isolation, terminal cache events and stale feedback covered by automated tests.           |
| Complexity             | More explicit lifecycle code than the original local timer. Not a line-count reduction.                   |
| Dependency             | One exact direct dependency, Zustand 5.1.0, in mobile only; no new shared package.                        |
| Native acceptance      | Pending: actual routing, background/foreground, audio and haptics on physical devices.                    |

No quantitative CPU, battery, bundle-size or production performance improvement has been measured.

## Comparison with a scoped React provider/reducer

A provider above navigation with a reducer could also preserve the deadline and isolate account/workout state without a dependency. A single changing context value would notify every consumer on countdown ticks; separate contexts or a custom external subscription layer could avoid that. Both alternatives still need the same runtime, account isolation, terminal-workout handling and asynchronous feedback guards.

The current Zustand store provides narrow subscriptions, synchronous actions and an independently testable vanilla instance without implementing a custom subscription mechanism. This is a concrete advantage for a frequently changing, cross-screen workflow; not evidence that Zustand is superior for low-frequency state or all features.

Retain the existing store rather than rewrite a tested pilot solely to compare frameworks. This is a design comparison plus automated evidence, not a benchmark or a second implemented prototype.

## Proposed next steps

| Stage                               | Decision and gate                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SM06 App settings                   | Review selector boundaries first. Only implement a targeted change if there is demonstrated avoidable coupling or rendering; preserve account-scoped AsyncStorage keys, pending writes, hydration, safe defaults and error behavior. No automatic persist middleware or duplicate preference source. |
| SM07 Active workout                 | Keep server data in TanStack Query and write locks local. A store extension is justified only by a defined cross-screen client workflow such as a compact active-session surface. Reuse the existing timer owner.                                                                                    |
| SM08 Trainer editor                 | Defer until a real multi-pane editor has shared selection/interaction requirements. Do not duplicate drafts, forms or server records.                                                                                                                                                                |
| Auth, theme, locale, offline drafts | No migration. Keep existing ownership and security/lifecycle semantics.                                                                                                                                                                                                                              |

For any proposed new store document the state owner, consumer list, scope, reset triggers, persistence policy, stale-response protection and test plan. Prefer a smaller existing mechanism when sufficient. Avoid adding dependencies to other workspaces or a common global store without separate review.

## Remaining acceptance and risks

- On Android and iOS, verify leaving and reopening the same workout, switching workouts, completing/canceling, logout/relogin and expiry after backgrounding. Test actual audio/haptics with settings changes and silent mode.
- Process termination intentionally discards the timer. No OS background alarm is promised.
- A remote terminal workout change is observed when the account-scoped query cache receives the relevant data; the timer itself does not poll or add API writes. Do not describe remote cancellation as instantly detected.
- Record device/platform, build, scenarios, outcome and evidence before native acceptance. Keep #325 open for remaining scope and #324 for its separate reconciliation requirements.

Recommendation: limited retention of the mobile pilot and evidence-driven review of new candidates; no blanket authorization. Revisit or replace the store if device verification reveals unacceptable lifecycle regressions or future maintenance outweighs selector benefits.
