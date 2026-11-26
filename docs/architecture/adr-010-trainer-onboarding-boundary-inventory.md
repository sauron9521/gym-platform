# ADR-010 — ABI06a1 Trainer Onboarding boundary inventory

- **Baseline:** [main c58729c](https://github.com/sauron9521/gym-platform/commit/c58729c30b598df519bda9261a039e702d824f92), after the Auth migration review (#940) merged.
- **Tracking:** [#909](https://github.com/sauron9521/gym-platform/issues/909), [ADR-010](adr-010-segregated-api-interfaces.md), [Auth review](adr-010-auth-migration-review.md).
- **Scope:** prepare narrow application contracts only; both existing controllers stay in TrainerOnboardingModule. No new route, provider instance, permission, dependency, database change or production authorization.

## Route and security inventory

| Method and path                              | Existing operation ID                    | Audience | Success | IP/min |
| -------------------------------------------- | ---------------------------------------- | -------- | ------- | -----: |
| GET /trainer-applications/me                 | TrainerApplicationsController_findMine   | Shared   | 200     |     60 |
| POST /trainer-applications                   | TrainerApplicationsController_submit     | Shared   | 201     |      3 |
| PATCH /trainer-applications/me               | TrainerApplicationsController_updateMine | Shared   | 200     |      3 |
| GET /admin/trainer-applications              | TrainerReviewController_findPending      | Admin    | 200     |     60 |
| POST /admin/trainer-applications/:id/approve | TrainerReviewController_approve          | Admin    | 200     |      3 |
| POST /admin/trainer-applications/:id/reject  | TrainerReviewController_reject           | Admin    | 200     |      3 |
| POST /admin/trainer-applications/:id/revoke  | TrainerReviewController_revoke           | Admin    | 200     |      3 |

The tracked canonical OpenAPI lists all seven operations. Tags remain Trainer applications and Trainer moderation. Shared uses ordinary cookie or bearer authentication; Admin explicitly selects the Admin cookie provider with AdminCookieRoute, AdminOriginGuard and AdminSessionPurposeGuard. Admin ownership is not permission by itself. The service checks admin.accounts.manage using the current allowlist and the repository checks current non-deleted Admin role. The existing sensitive mutation step-up policy is tracked separately by [#290](https://github.com/sauron9521/gym-platform/issues/290), still open. No new elevation or security-policy approval is implied.

The applicant can submit or edit only as an eligible email-verified ATHLETE without an active trainer profile. Actor ID comes from the authenticated principal; strict Zod schemas reject extra privilege fields. Reads are owner-scoped with a separate safe projection. The partial unique index and compare-and-set pending update remain authoritative for concurrent submissions and edits. Approval/rejection/revocation retain serializable repository transactions, current reviewer checks, self-review denial, transition validation and atomic profile updates. Identical actor/action/reason retries return the existing record; preserve the current conflict behavior. Admin audit uses the existing pseudonymized logging contract after an allowed decision, not a durable transactional compliance log. No attempt is made to redesign that policy in this slice.

## Public application contracts

The existing services are sufficiently narrow; a new facade would only duplicate their behavior.

- [public-api.ts](../../apps/api/src/modules/trainer-onboarding/public-api.ts) exposes TrainerApplicationsService (findMine, submit, updateMine), TrainerReviewService (findPending, decide), the existing input schemas and types, Reviewer and TrainerReviewAction.
- [TrainerOnboardingModule](../../apps/api/src/modules/trainer-onboarding/trainer-onboarding.module.ts) exports only the two existing service providers. Both repositories, persistence selects, audit infrastructure and guards remain internal or owned by their existing infrastructure module.
- Move the action vocabulary from the review repository to its existing domain lifecycle contract; no transition implementation changes. Both legacy controllers consume the new public barrel without physical relocation.
- A test-only consuming module imports TrainerOnboardingModule, injects the exact exported instances, and verifies unique ownership of both controllers, services and repositories. Module metadata tests pin the runtime exports. The service contracts assume authenticated actor data supplied by the HTTP adapter; they are not independent authentication mechanisms.

## Follow-up sequence

1. ABI06a2: move the complete TrainerReviewController with its existing class/method names to the Admin leaf. Reconcile current #290 and [SA01 #925](https://github.com/sauron9521/gym-platform/pull/925) before the move. Do not duplicate guards, audit providers or repositories; retain the current role and cookie policy. Verify the actual privileged authorization and concurrent decision scenarios.
2. ABI06a3: move the complete TrainerApplicationsController to the Shared leaf; retain ordinary authentication, eligibility, private projections and owner-scoped mutations. Complete the zero-controller core with an explicit audience declaration, then review.
3. Preserve class and handler names so stock throttler and Swagger identities remain unchanged. If a later split requires renaming, use the existing stable HTTP operation mechanism rather than silently resetting the rate bucket. Keep all original tests, historical inventory rules and canonical client contracts. Refresh actual client consumers and main before each slice.

This is contract preparation, not completion of the migration. All seven routes still belong to the legacy module at this stage.

## ABI06a2 Admin review relocation

[AdminTrainerOnboardingApiModule](../../apps/api/src/api/admin/trainer-onboarding/admin-trainer-onboarding-api.module.ts) owns the unchanged [TrainerReviewController](../../apps/api/src/api/admin/trainer-onboarding/controllers/trainer-review.controller.ts). Only its public contract import changes; class and handler names, Swagger tags, rate budgets and default throttler identity remain unchanged. The core still owns both services, repositories, audit dependency and the three Shared application operations. Route-scoped guards resolve in the Admin leaf; remove redundant core guard registrations. No new providers, permissions, audit policy or transactions. The original review unit cases and metadata assertions move with the controller; runtime DI and competing decision regression tests verify the composition and existing serializable conflict behavior. TrainerOnboarding was added after the frozen migration source inventory, so no historical relocation entries or validator changes are needed. #290 remains open and #925 remains a draft at this baseline; neither is implemented or closed by this transport-only move.

## ABI06a3 Shared application relocation

[SharedTrainerOnboardingApiModule](../../apps/api/src/api/shared/trainer-onboarding/shared-trainer-onboarding-api.module.ts) now owns the unchanged [TrainerApplicationsController](../../apps/api/src/api/shared/trainer-onboarding/controllers/trainer-applications.controller.ts). Preserve ordinary authentication, actor-derived owner identity, existing strict schemas, response projections, names, paths, statuses, tags and rate budgets/stock throttle keys. The core explicitly registers no controllers and retains its two exported services, private repositories and existing audit dependency. The audience manifest declares Admin and Shared. The original controller tests move with it; registry and actual Nest composition tests cover both leaf owners and zero core controllers. No frozen inventory entries are affected, no schema or security policy changes. All seven operations are audience-owned (Shared 3, Admin 4). ABI06a4 performs cumulative review before moving to other features.
