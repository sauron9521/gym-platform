# ADR-010 — ABI06b1a Notifications boundary inventory

- **Baseline:** [main b09b2cc](https://github.com/sauron9521/gym-platform/commit/b09b2ccaaa12f2afcc35ef8fac5ba12d64edc5ac), after TrainerOnboarding review #944.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md).
- **Scope:** prepare the account settings contract only. The existing controller remains in NotificationsModule.

## Routes and consumers

| Method and path                       | Operation ID                         | Audience | Success |      IP/min |
| ------------------------------------- | ------------------------------------ | -------- | ------- | ----------: |
| GET /users/me/notification-settings   | NotificationSettingsController_get   | Shared   | 200     |          60 |
| PATCH /users/me/notification-settings | NotificationSettingsController_patch | Shared   | 200     | 10 (global) |

Both operations use ordinary authenticated account identity, cookie or bearer authentication, strict empty query schema, and no-store response headers. Preserve names, decorators, response schema and current rate-limit identity. Shared ownership does not change authorization. The current browser/native API client contract tests exercise these paths; no direct application consumer of the literal route was found in the inspected web/mobile/trainer/admin source. This does not establish absence of indirect or future consumers.

## Application contract and persistence

The existing NotificationSettingsService has only get and patch use cases. Export this provider through NotificationsModule and an explicit [public-api.ts](../../apps/api/src/modules/notifications/public-api.ts), together with the existing patch schema/type and reminder lead vocabulary used by Swagger. Do not export the repository, general policy functions or storage projections. Both methods consume authenticated owner identity supplied by the adapter; they are not independent authentication mechanisms.

The [repository](../../apps/api/src/modules/notifications/repositories/notification-settings.repository.ts) remains private. Reads use a repeatable-read snapshot and do not create default rows. Writes use a user-row lock and a transaction to serialize first writes, merge partial settings and fence inactive/deleted accounts. Keep strict allowed category/channel pairs, default-off consent, server-owned consent timestamps, replay semantics, revocation and fail-closed invalid timezone behavior. Consent is not delivery authorization or native OS permission; no notification transport, scheduler or delivery capability is added.

Keep the original combined controller/service test assertions as a dedicated core service test and separate adapter delegation tests. This removes the adapter test's private repository import before relocation. Boundary unit tests pin exact runtime exports and a test-only importing Nest module proves service instance identity and single ownership of controller and repository.

## Next slice

ABI06b1b moves the whole NotificationSettingsController and its adapter test into SharedNotificationsApiModule, with explicit audience manifest and zero core controllers. Keep the original controller class/handler names, all route metadata and stock rate-limit behavior. No frozen inventory paths are affected at this baseline. Verify canonical OpenAPI/client equivalence, unique real module ownership, existing HTTP owner isolation and concurrent consent/settings regressions, and all architecture/tooling gates. Do not change domain policy, repository transactions, schema, dependency versions or deployment topology in either slice.

## ABI06b1b Shared API relocation

[SharedNotificationsApiModule](../../apps/api/src/api/shared/notifications/shared-notifications-api.module.ts) owns the complete [NotificationSettingsController](../../apps/api/src/api/shared/notifications/controllers/notification-settings.controller.ts). The controller changes only its import of the existing public contract. Both original method names, authenticated owner selection, request/response schemas, cache headers, rate budgets and stock throttler identities are retained. NotificationsModule explicitly registers no controllers and still exports only NotificationSettingsService. Its repository, domain rules and transaction boundaries remain private and unchanged. The shared audience manifest, registry metadata tests and real Nest composition regression pin the sole controller owner and single service/repository instances. No frozen inventory paths need relocation.

The module's two routes are now audience-owned. Continue with the account deletion boundary preparation after this slice passes contract, HTTP, architecture and CI checks; no notification delivery capability or production authorization is implied.

## Subsequent functional extension

After the ABI06b1b migration, #568 added the transactional publication
function to the public contract. N03/N04 (#566/#567) add the shared
NotificationInboxController and NotificationInboxService; the Inbox
repository remains private and NotificationsModule remains controller-free.
The original settings routes, operation IDs and rate limits are unchanged.
