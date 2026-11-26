# ADR-010 — ABI06b2a Account deletion request boundary inventory

- **Baseline:** [main 21fd9fc](https://github.com/sauron9521/gym-platform/commit/21fd9fc3ffbf03bb6b0f7856da36c80685dc82ef), after Notifications #946 merged.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [ABI06a4 review](adr-010-trainer-onboarding-migration-review.md).
- **Scope:** prepare the existing account deletion request intake contract; the controller remains in AccountDeletionRequestsModule. Intake is not account deletion execution.

## Route inventory

| Method and path                         | Operation ID                              | Audience | Success | IP/min |
| --------------------------------------- | ----------------------------------------- | -------- | ------- | -----: |
| GET /users/me/account-deletion-request  | AccountDeletionRequestsController_findOwn | Shared   | 200     |     60 |
| POST /users/me/account-deletion-request | AccountDeletionRequestsController_submit  | Shared   | 200     |      3 |

Both routes retain ordinary cookie or bearer authentication, current-user identity, Users Swagger tag and private API no-store handling. POST uses the strict confirmation schema with literal true, nonblank password and optional six-digit TOTP. Credentials are write-only in OpenAPI. The service requires current TOTP when MFA is enrolled; schema optionality is not authorization to omit it for enrolled accounts. The current generated client contains both routes; no literal route consumer was found in inspected web/mobile source. Do not infer absence of indirect clients.

## Application boundary

The [public-api.ts](../../apps/api/src/modules/account-deletion-requests/public-api.ts) exports the existing AccountDeletionRequestsService and confirmation schema/type. The module exports only this service. The two use cases findOwn and submit take authenticated owner identity from the HTTP adapter; the service is not an independent authentication mechanism. Keep repository, credential projection and rate storage private to their existing modules. Do not expose password hashes, MFA internals, or a general deletion operation.

Preserve the per-account quota (3 attempts per 60 seconds, existing account-deletion key/name) before credential reads and password verification, in addition to the HTTP IP limit. RateLimitStorageModule owns the existing storage singleton, with Redis when configured and single-process memory otherwise. Keep password verification, enrolled MFA TOTP confirmation and generic credential failures unchanged. The repository rechecks active status, deletion state, verified password hash and authInvalidatedAt under a user-row lock before idempotent receipt upsert. Receipt reads select only the active owner's request ID and timestamp; no account deletion, session revocation or workflow scheduling is introduced.

Exact public export tests, confirmation schema tests and an importing Nest test module pin the existing contract and unique service, repository, quota storage and controller owners. Existing service tests exercise password, TOTP, quota and changed credential state with mocks; existing Users HTTP/PostgreSQL tests exercise anonymous/foreign-origin denial, strict input, wrong password, concurrent cookie/bearer submission, private receipt and per-owner throttling. A real enrolled-MFA HTTP regression remains recommended before relocating the controller; the current mocked TOTP tests are not proof of end-to-end TOTP behavior.

**Security follow-up:** the paragraphs above describe the historical transport baseline. See the [current intake policy](../api/modules/account-deletion-requests.md) for the subsequent #948 fail-closed rollout restriction.

## Next slice

ABI06b2b moves the complete AccountDeletionRequestsController and its adapter tests to SharedAccountDeletionRequestsApiModule. Keep the original class/handler names, route metadata, current-user identity and rate keys. Add the explicit shared audience manifest and controller-free core assertion, preserve the existing distributed quota and repository transaction, and verify real Nest ownership, canonical schema/client equivalence and relevant authorization regressions. No frozen source inventory paths are affected at this baseline. No new deletion policy, schema, dependency or deployment changes.

## ABI06b2b Shared API relocation

[SharedAccountDeletionRequestsApiModule](../../apps/api/src/api/shared/account-deletion-requests/shared-account-deletion-requests-api.module.ts) owns the unchanged [AccountDeletionRequestsController](../../apps/api/src/api/shared/account-deletion-requests/controllers/account-deletion-requests.controller.ts). Only the public contract import changes. Keep class/handler identity, guards, validation, status, no-store handling and stock throttler budgets. The core explicitly registers zero controllers and retains the existing service, private repository and RateLimitStorageModule dependency. Registry and runtime composition tests pin unique controller, service, repository and storage ownership.

The [enrolled MFA regression](../../apps/api/test/e2e/users/account-deletion-mfa.e2e-spec.ts) enables a real encrypted TOTP verifier only in a test module, using the registered Prisma store. The ordinary credential gate deliberately denies enrolled accounts both old sessions and new ordinary sign-ins, so a successful enrolled HTTP request is not reachable in the current composition. Preserve that fail-closed gate. Exercise missing, invalid and valid fresh TOTP, receipt persistence, intact account and per-account quota directly through the real application service. Existing Users E2E covers ordinary HTTP intake and cross-owner receipt isolation. The existing AppModule intentionally leaves global MFA unconfigured (see [Admin cookie-only boundary](../admin/admin-cookie-only-boundary.md)); internal Admin MFA is separate. This is not proof of production enrolled-account HTTP readiness. [#948](https://github.com/sauron9521/gym-platform/issues/948) tracks the required security-policy reconciliation before Beta/production. No global MFA activation or policy change in this transport-only PR.

The preceding paragraph records the historical transport PR evidence; the subsequent #948 regression now uses the real registered MFA composition and denies enrolled intake.

Both intake operations are audience-owned; no actual deletion, schema, dependency or frozen inventory change. Continue with BodyMeasurements contract preparation after review and manual merge, coordinating #948 independently.
