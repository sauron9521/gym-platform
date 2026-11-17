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
