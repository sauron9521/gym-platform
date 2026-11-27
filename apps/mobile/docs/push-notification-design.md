# Push notification consent and payload safety

**Status: contract foundation only. No push notifications are enabled by this PR.**

The policy module contains no calls to Expo, native permission prompts, device
push registration, token persistence, network requests or notification delivery.

## Consent and eligibility

- All categories (`trainingReminders`, `trainerMessages`, `marketing`)
  default to **false**. Unexpected preference fields are rejected.
- A future opt-in UI must explain notification categories and require an
  explicit, reversible user choice; native permission must only be requested
  after the user chooses to enable notifications.
- `canRegisterPushToken` is an eligibility check, **not** registration.
  It requires an authenticated UUID, verified email, explicit opt-in, native
  permission `granted` and at least one enabled category.
- No permission or consent can be inferred from an existing Expo token.
  The backend must independently verify account identity, preferences,
  token ownership, and authorization for the requested notification category.
- Revoke or unlink device tokens on logout, account switch, preference
  disablement and applicable data-deletion requests. Account-scoped token
  access and multi-device consent must be designed before production use.

## Privacy and delivery boundary

The only accepted transport envelope is `{ notificationId: UUID }`.
Both encoding and parsing use a strict schema. The future sender must not
include names, emails, workout progress, message bodies, credentials or
other private content in visible push titles, bodies or data payloads.
The authenticated app can fetch the notification details from the API only
after checking current account access; the server must reject unauthorized IDs.

**Implementation follow-up:** choose Expo SDK-compatible `expo-notifications`,
update the pnpm lockfile, provision EAS/APNs/FCM credentials, implement a
server-side token lifecycle and secure notification inbox, and add staging
and real-device tests for Android and iOS. Validate foreground/background
behavior, account switching, revoked consent, OS permission changes and
token rotation. No automatic registration or scheduling is safe before then.

## M13.1a — secure open-intent preparation (#574)

The current main contains only the outbox Prisma foundation (#568); Inbox
records (#566), authenticated Inbox REST/OpenAPI (#567) and notification
settings (#565) are not implemented. Do not build a mock Inbox, persist
a second client-side read state or guess endpoint DTOs.

The local `notification-open.ts` coordinator reuses the existing strict
notification-ID envelope. It accepts a single explicit intent, requires a
verified Athlete scope, and delegates resolution to a future authenticated
adapter. Only a matching notification ID and an allowlisted semantic workout
or program **assignment** UUID may map to an existing internal route.
External URLs, admin targets, arbitrary IDs in OS payloads and extra fields
are rejected. This local contract is not a proposed server response schema.

The future adapter must fetch a fresh USER-scoped notification detail,
check current resource authorization and normalize the result into the local
target contract. Never treat an opaque UUID as proof of access, infer a target
from notification text or trust cached details. Server authorization is
required again at the destination. Scope is provided by the verified auth
lifecycle; its opaque epoch identity must change on lock, sign-out, account
switch and re-verification (including the same account). Call cancel on
background/lock/logout and unmount; never replay a queued intent after login
or reconnection. Each explicit open supersedes the previous attempt, aborts
its signal and rejects stale results even if the adapter ignores cancellation.
No token, account history or notification payload is persisted. No resolver,
router, push handler or user-facing Inbox is wired into the app yet.

Next: finish #565/#566/#567 in the shared backend workstream and regenerate
the typed API client; then implement real account-scoped list/unread queries,
cursor pagination, confirmed read/read-all writes, and the authenticated
navigation adapter with session revocation and fresh resource access tests.
Native #348/#349 proof remains a separate required gate. Keep #574 open;
there is no OS permission request, push delivery or notification registration.

## N14 — account preferences (#577)

The earlier contract-only status above describes the historical foundation.
The USER Inbox and account preference API are now implemented, and
`/profile/settings` edits the four server allowlisted consent pairs,
quiet hours and reminder lead. The legacy eligibility helper is not
used by this UI or any delivery path. The new read-only permission
contract intentionally returns unavailable in current builds without
a native adapter. Injected permission-reader tests cover granted, denied,
undetermined and unavailable. Actual native status reading and delivery
remain #342/#343; device acceptance remains #348/#349.

## N14a — local reminder plan (preparation only)

The strict account settings response parser is reused by the pure
`local-reminder-plan.ts` planner. Shared domain timing rules are identical
to the API candidate policy. The planner requires explicit granted
permission, a current owner, confirmed consent and a complete fresh
snapshot from its future caller. It returns internal IDs and due times
only; these are not a native payload or proof of scheduling.
No OS API or permission prompt is wired. The supported Expo SDK manifest
lists expo-notifications ~58.1.9; evaluate actual installation and native
development builds in a separate PR. The proposed cap of 32 candidates
must be reconciled against actual OS capacity and a bounded query horizon.
See [notification delivery](../../../docs/architecture/notification-delivery.md)
for the cancellation, identity and device readiness gates.

## N14b — native permission adapter (#342)

Pin expo-notifications 58.1.9, the installed Expo SDK 58.0.26 manifest's
compatible release. The online installer suggested 58.1.10 with an
automatic minimum-release-age exception; that exception was removed
and the older SDK-compatible patch installed under the existing policy.
The config plugin explicitly disables remote and background remote
notifications. No push credentials, token registration, background
task, exact-alarm permission or OS schedule is enabled.

The adapter uses narrow permission/channel modules of the pinned
library to avoid the barrel's push auto-registration side effect.
These internal module paths are intentionally isolated and must be
reviewed on library upgrades. Web, Expo Go and missing native modules
return unavailable without native prompts. Android and iOS permission
responses are read on the settings screen and re-read on focus/resume.
iOS provisional/ephemeral grants and disabled alerts do not authorize
delivery. Android may report denied before the first request: use
canAskAgain, not a guessed initial status.

The separate permission button appears only with confirmed account
WORKOUT/LOCAL_REMINDER consent and requestable OS status. It never
changes account consent. The adapter checks foreground/session/screen
and current settings evidence around asynchronous preparation, serializes
prompts across remounts, creates a generic Android reminder channel
only on explicit request, and reads status again instead of trusting
the prompt result. Once an OS dialog has started it cannot be cancelled
on account switch; no account-scoped delivery is granted by its result.
If permission is permanently denied, the system settings must be used.
Channel availability and native scheduling reconciliation remain separate
gates. No physical Android/iOS acceptance is implied by JS tests/exports.

## N14c — native reconciliation primitive (#342)

This slice provides an unwired native port and reconciler, not a running
scheduler. It accepts a fresh scoped plan from the future coordinator.
It reads actual pending requests, removes obsolete managed identifiers,
verifies cancellation, schedules missing candidates, and verifies the
final inventory. Only the reserved ovranto.workout-reminder namespace
is cancelled; unrelated OS requests are preserved. A single JS process
lock prevents overlapping reconciliation and cleanup. Busy is not success:
the future coordinator must revoke the generation fence and retry cleanup
after an in-flight operation settles.

Identifiers are deterministic SHA-256 digests of version, account, workout,
due instant and localized generic copy, using existing expo-crypto. The OS
content has no account/workout identifiers or private workout data. This is
pseudonymization, not a cryptographic authorization boundary. The proposed
32 managed / 48 total pending budget reserves capacity for other requests.
A five-second admission margin avoids immediate presentation of expired
requests. Round up to whole seconds because iOS DATE truncates milliseconds;
skip if rounding crosses a minute boundary (quiet-hour classification).
These conservative defaults are provisional until device QA.

Use one-shot DATE and bestEffort delivery, never exact-alarm authorization.
Require fresh OS grant and a usable Android channel (no DND bypass).
The Android serializer reports the absolute timestamp, channel and delivery;
iOS reports a non-repeating interval, not the original absolute deadline.
Its deterministic identifier binds the intended instant, but listing
cannot independently verify the actual fire time. Native acceptance is not
delivery confirmation. An ambiguous error attempts managed cancellation,
never blindly replays scheduling. Cancellation failure is explicitly a
failure, not proof that pending notifications are gone.

The port is not imported by runtime screens/providers yet. No permission
prompt, token, background task, foreground handler, listener, automatic
scheduling or logout integration is introduced here. Next implement fresh
bounded workout snapshot acquisition and generation fencing, then logout,
account switch, resume and revocation cleanup. Actual Android/iOS timing,
permission/channel behavior, cancellation reliability and device-offline
limitations remain mandatory #348/#349 acceptance gates.

## N14d — fresh reminder evidence (#342)

The unwired preparation service reads current OS permission, then the
owner-fenced notification settings GET and a single planned workout
summary page. It uses the existing /workouts API with status PLANNED,
scheduledAtAsc, inclusive scheduled bounds and limit 100. The provisional
horizon is seven elapsed days from the preparation anchor. Reject any
overflow, partial/malformed metadata, foreign owner, duplicate ID,
nonplanned status, invalid timestamp or out-of-range/unsorted row.
Strip all unrelated workout fields. One page avoids cross-page offset
drift but does not guarantee a transactionally consistent snapshot
across settings and workout reads or against remote edits.

No cached settings, optimistic state or cached workout list is treated
as proof. The plan fence expires after 30 seconds, and is permanently
invalidated by account epoch changes, relevant query cache success,
invalidation/removal, local mutation admission, backgrounding, offline
transition or caller abort. Reuse existing TanStack Query subscriptions
and scoped API; no new event bus. Any local mutation is conservatively
treated as possible evidence change. A future coordinator must dispose
the fence after use, reacquire evidence after mutation settlement and
serialize cancellation with reconciliation. This slice does not mount
the coordinator, schedule notifications or perform periodic reads.

Seven days, 100 rows and 30 seconds are proposed conservative bounds;
overflow blocks rather than truncates. Concurrent remote edits can
still occur after a successful read; an OS reminder cannot be revoked
by a server while the device is offline or the app is not running.
No freshness guarantee beyond the local evidence fence is implied.
LN05 will handle lifecycle wiring and cancellation, with activation
still gated on real Android/iOS QA (#348/#349).

## N14e — lifecycle composition (#342)

One reminder lifecycle is created at the application composition root
and combined with the existing offline draft private-data participant.
Auth stays unaware of the native notification implementation.
The release gate LOCAL_REMINDER_SCHEDULING_ENABLED is hard-coded false:
the runtime attempts managed cleanup at startup, verification, active
locks and logout but never prepares a plan, schedules an OS reminder,
or subscribes to the scheduling refresh events while disabled.

The coordinator's enabled path is tested with injected ports only.
Every lifecycle change revokes the old generation synchronously and
aborts preparation. A single native operation queue serializes cleanup
with reconciliation; cleanup must be verified before any new native
write. Network preparation remains outside that queue because a 401
may itself await logout cleanup. Failed or unavailable cancellation
leaves cleanup required and blocks scheduling until a later event
retries it. A normal transition to background locks preparation but
does not cancel already settled OS reminders. A write in flight is
fenced and must clean up if it settles after the generation changes.
On cold launch, active lock, verified account change, resume/reverify
and explicit logout, managed cleanup is attempted irrespective of
network availability.

The future enabled runtime observes existing account/workout/settings
cache changes, mutation admission and settlement, focus, connection
and locale. Active refresh first fences and requests cleanup, then
reacquires fresh evidence. Concurrent refresh requests coalesce while
a read settles; no automatic write replay or background polling.
This intentionally conservative approach may cancel/reschedule more
often than a diff-only refresh. Measure native latency and churn during
QA before activation. Native cleanup is best effort: process death,
OS failure, offline remote changes and a never-settling native call
cannot guarantee immediate removal. Auth locks credentials regardless
of cleanup success; the coordinator does not claim that failed cleanup
has removed notifications. No push registration or foreground
presentation handler is introduced.

Next LN06: build and test on Android/iOS, prove exact timing and
cancellation, foreground presentation behavior, permission changes,
timezone and clock changes, remote/offline limitations and recovery
from failed cleanup. A separate reviewed activation decision is
required; do not flip the gate merely because JS tests pass.

## N14f — controlled reminder QA (#342)

**Status: configuration and test preparation; device acceptance NOT RUN.**
Normal development, preview and production builds retain the false release
gate. Only the explicitly selected internal EAS `reminder-qa` profile can
embed the versioned QA marker. Its channel is separate, environment is
preview, Android output is APK, and OTA updates are disabled. The dynamic
Expo config strips any marker from ordinary builds and refuses QA opt-in
outside that profile. Runtime requires the marker, matching native platform,
configured QA application ID, embedded HTTPS API URL and native standalone
or bare environment. Web and Expo Go fail closed.

This is a build configuration safeguard, not authentication or proof of
artifact provenance. The owner must supply and independently verify a
separate app ID, Expo project/signing, staging API and production API.
No actual infrastructure values are committed. No remote flag, automatic
release, or public debug toggle is added. The QA settings panel shows a
localized test-only label; real consent and OS permission are still required.
A successful device-permission read triggers fresh preparation even if the
Android system prompt never caused an app focus transition; removing its
settings-screen cache entry is not treated as permission revocation.

### Operator preflight and build

Use only reviewed main and a disposable installation. Configure the EAS
preview environment with the approved public HTTPS staging API as
`EXPO_PUBLIC_API_URL`, the same exact value as
`OVRANTO_REMINDER_QA_API_URL`, and the independently approved production
HTTPS API as `OVRANTO_PRODUCTION_API_URL` (different origin). Set
`OVRANTO_REMINDER_QA_PLATFORM` to exactly android or ios and
`OVRANTO_REMINDER_QA_APP_ID` to the owned separate identifier ending
in .reminderqa for that platform. These values are public configuration,
not secrets. Keep the QA opt-in in the dedicated profile only.
For local config inspection, set the same values in the shell, including
EAS_BUILD_PROFILE=reminder-qa and OVRANTO_REMINDER_QA=1; unset them after
the inspection. If the EAS CLI does not resolve the profile name locally,
pass EAS_BUILD_PROFILE=reminder-qa explicitly for the dedicated command only.
The actual remote build must resolve the same platform and configuration.
Do not reuse production signing or distribute a QA build to ordinary users.

From apps/mobile, inspect the resolved public config with
`pnpm exec expo config --type public` before building. Verify name
OVRANTO Reminder QA, the chosen package/bundle ID, distinct scheme,
matching marker and staging target, disabled updates and remote notification
plugin options. Review the EAS project link, native signing and account
ownership separately. Then, only after operator approval, request
`eas build --profile reminder-qa --platform android` (or ios).
Verify the resulting artifact belongs to the correct project, reviewed commit,
native identifier, signing and embedded API; independently hash the artifact
and install it on an authorized disposable device. The existing ordinary
preview preflight remains unchanged and still requires reviewed app IDs.
No EAS build or installation was executed in this PR.

### Device acceptance matrix

Use distinct disposable verified athlete accounts A and B, Ukrainian and
English locales, no prior consent, and synthetic workouts only. Seed one
PLANNED workout with a due reminder at least two minutes in the future
(account lead 15 minutes; scheduledAt = desired due + 15 minutes).
Choose a time outside quiet hours for the positive case; verify server
canonical settings and workout status. Use fresh fixtures for each run.
The local Maestro flow `reminder-qa-mode-smoke.yaml` checks login, the QA
label, settings and logout. It does not grant permission, mutate consent,
or prove delivery. Run on the verified installed QA binary using APP_ID,
E2E_EMAIL and E2E_PASSWORD; scroll/system UI behavior needs real execution.
Do not use the ordinary preview workflow for this QA artifact.

| Check                            | Required observation on Android and iOS                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default / denial                 | No managed pending requests before consent and explicit OS grant; denied or provisional iOS authorization does not schedule                          |
| Positive                         | Exactly one managed request; generic localized payload, actual notification near intended time while backgrounded                                    |
| Idempotence                      | Repeated refresh/resume leaves at most one request per candidate; no unrelated requests cancelled                                                    |
| Edit / completion / cancellation | Old pending request removed; only a still-eligible changed workout can have a new request                                                            |
| Settings / revocation            | Consent off, quiet hours, lead change, OS permission and Android channel change reconcile correctly                                                  |
| Account lifecycle                | Logout, A to B, expired session, cold relaunch and failed reverify do not retain A's pending requests                                                |
| Background / offline             | Settled eligible requests survive normal backgrounding; offline remote change limitation documented; reconcile on return                             |
| Clock / timezone                 | Record profile IANA zone and device zone, DST and clock changes; no quiet-window delivery or unexpected early trigger                                |
| Capacity / error                 | Verify 32 managed / 48 total, missing channel, ambiguous write and failed cleanup behavior without false success                                     |
| Foreground / locked device       | Observe actual foreground presentation and lock-screen privacy; no handler is implemented yet, so missing foreground delivery is a blocker, not PASS |
| Ordinary release                 | Same staging fixture in ordinary preview never schedules; no QA marker or remote push registration                                                   |

Record private evidence for each platform: reviewed commit and build hash,
verified package/bundle ID and staging origin, OS/device version, locale,
profile and device timezones, fixture labels, expected UTC due time, actual
delivery time, pending managed count before/after, observed consent/permission,
and PASS/FAIL/NOT RUN. Use the native pending inventory from an authorized
read-only inspection harness; Android system diagnostics may contain private
data, and iOS interval listing alone cannot establish absolute fire time.
Never expose identifiers, tokens, credentials, raw payloads or personal data.
If native inspection, timing observation or cleanup evidence is unavailable,
record NOT RUN. Do not mark a case passed based on the Maestro mode smoke,
Vitest, Expo config or Metro alone. Clear managed test reminders, revoke
consent, log out, remove test fixtures and uninstall the QA build afterward.

**Activation remains NO-GO** until #348/#349 actual device evidence,
all required cases pass, any foreground/channel/reconciliation gaps are
resolved, and the owner explicitly approves activation. #342 stays open.
Push #343 remains gated. No ordinary release activation in N14f.
