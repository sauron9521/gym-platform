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
