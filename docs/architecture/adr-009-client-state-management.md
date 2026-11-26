# ADR-009: Client state ownership and scoped store pilot

- Status: Proposed for owner review (2026-11-26)
- Baseline: main `7cea736` (#889)
- Related: [#325](https://github.com/sauron9521/gym-platform/issues/325), [#324](https://github.com/sauron9521/gym-platform/issues/324), [#711](https://github.com/sauron9521/gym-platform/issues/711)

## Context and evidence

Static inspection of mobile, web, trainer and admin source at the baseline found no Zustand, Redux or Jotai dependency in their manifests. Mobile has four application contexts (auth, theme, locale, app settings). Web has an instance-local TanStack Query provider. Most state is screen/form-local; counts are not a migration criterion.

Mobile `features/workouts/ui/rest-timer.tsx` owns countdown, deadline, completion and feedback in component state; `screens/workouts/model/use-workout-details.ts` emits a screen-local rest-start event. The details screen renders the timer keyed by workout ID. The absolute deadline already handles elapsed background time while mounted, but unmount loses timer state. Issue #325 explicitly calls for timer continuity across normal navigation and authoritative set completion.

Mobile `features/app-settings/model/app-settings-context.tsx` currently handles account-scoped AsyncStorage, defaults, read/save errors, stale async responses and pending writes. Replacing this with generic persistence is not a demonstrated improvement. Auth owns token lifecycle, account scope and cache cleanup. Offline workout drafts have a dedicated encrypted repository. None should be rewritten as part of the timer pilot.

## Proposed decision

Use the smallest state owner that satisfies the required lifetime:

| State                                                      | Owner                                             |
| ---------------------------------------------------------- | ------------------------------------------------- |
| Component or screen interactions                           | React state/reducer                               |
| Forms                                                      | React Hook Form or existing local form logic      |
| Remote entities and mutation results                       | TanStack Query or existing server data mechanisms |
| Shareable web filters/navigation                           | URL/router                                        |
| Low-frequency injected context                             | Existing scoped React Context                     |
| Cross-screen ephemeral client workflows                    | Feature-scoped store, only when justified         |
| Durable offline drafts, credentials and device preferences | Existing dedicated storage and lifecycle          |

Prefer Zustand for a narrowly scoped mobile pilot, subject to owner approval, dependency compatibility review, and comparison with a scoped React provider/reducer. Do not introduce Redux, a root mega-store, a shared state package, or platform-wide migration. Keep domain functions independent of React and Zustand.

## Pilot boundary: mobile rest timer

- One timer owner above the workout screen, scoped to the current account and workout; no cross-account or cross-workout bleed. Define explicit stop/reset on completion, cancellation, logout and account change. Reject stale mutation callbacks.
- Preserve manual start/pause/resume/reset, preset selection and auto-start only after authoritative set completion when the current preference permits it. Never replay API writes or copy server workout state.
- Preserve absolute deadline; derive display remaining from the clock. Ensure only one completion/feedback side effect per timer run, including navigation and foreground transitions.
- No durable timer persistence or new background notification behavior in the initial pilot. Document process termination behavior; existing offline draft and settings mechanisms remain authoritative.
- Keep subscriptions narrow; avoid app-wide per-second updates. Do not expose credentials or private workout payloads in devtools or persistence.

## Delivery and review gates

1. This documentation PR records evidence and the proposed ownership rules only.
2. After owner review and checking parallel mobile work, implement one mobile-only timer pilot under #325. Select the minimal dependency version compatible with the existing workspace and run dependency, lint and type checks.
3. Cover manual controls, successful versus failed/ambiguous set writes, settings changes, navigation/unmount/remount, expiry while backgrounded, account/workout switch, logout, stale callbacks and exactly-once foreground feedback. Preserve existing regression suites; verify on native devices before claiming native acceptance.
4. Evaluate the pilot against a provider/reducer alternative: duplicate state removed, understandable lifecycle, isolated subscriptions, testability, dependency cost and maintenance burden. Revert or retain the smaller alternative if the benefit is not clear.
5. Only after pilot review consider app settings selectors or other genuinely shared client state. Do not migrate existing account-scoped storage, authorization, offline drafts or screen-local write locks by default. Reassess trainer editor only when multi-pane shared interaction requirements exist. Any Next.js store must be instance/request scoped as appropriate and hydration-safe.

## Consequences

One additional dependency may be justified by timer continuity and independent consumers; it adds lifecycle and isolation obligations. No library is required for ordinary local state. This proposal grants no implementation, release or broad migration approval and does not close the related issues.

## Mobile pilot implementation

The timer uses an account-scoped vanilla Zustand store, provided above navigation. Its active workout scope changes when another in-progress workout is selected; returning to the same workout keeps the countdown and manual preset. Terminal workout cache updates and account changes clear the state. A single runtime handles foreground reconciliation and feedback, while only timer consumers subscribe to countdown ticks. The server-confirmed set mutation path remains unchanged. There is no disk persistence or OS-level background alarm: process termination clears the timer, and expiration while backgrounded is reconciled on foreground.

The pilot is subject to CI, owner review, native device verification and a follow-up evaluation before any wider adoption.

See the [SM05 pilot evaluation](adr-009-pilot-evaluation.md) for merged evidence, comparison with a scoped provider/reducer, proposed limited retention and remaining native acceptance. Owner decision remains pending.

## SM06: app settings selector boundaries

The mobile app settings provider previously exposed one changing Context value to the settings screen, workout controller and navigation root. Saving any preference therefore notified all three consumers, including on intermediate storage status changes. The scoped vanilla store now owns the in-memory preferences and actions; the Context transports only the instance. Navigation selects duration and feedback, the workout controller selects account, duration, keep-awake and a stable confirmation-time gate, and the settings screen observes the complete state.

Existing account-scoped AsyncStorage keys, safe hydration defaults, write acknowledgement, retry and pending-write coordination remain intact. Theme, locale, authentication, timer state and offline drafts retain their respective owners. Selector regression tests demonstrate unrelated changes do not render a duration or action-only subscriber; this is not a measured application-wide performance claim.

## SM07: active workout continuation

Home and the workouts list share a compact, athlete-only continuation shortcut for the most recently opened in-progress workout in this app session. It reads the existing Rest Timer Store scope and countdown; no third store, duplicated server workout record, background polling or new API call is necessary. Only the countdown component subscribes to timer ticks. The workout details screen remains the owner of workout mutations, forms and write locks.

The shortcut is not a server-wide active workout discovery mechanism and is not persisted across process termination. It clears on account change, matching terminal detail/list evidence or explicit detail access denial/not-found. A missing row in a filtered or paginated list is not terminal evidence; remote changes are observed when existing queries receive the relevant result. Opening the shortcut uses the existing workout route and reconciliation path. Native navigation and device acceptance remain pending.
