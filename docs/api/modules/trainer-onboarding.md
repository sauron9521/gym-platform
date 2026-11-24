# Trainer onboarding and approval lifecycle (M05 / #309–311)

**Current status:** persistence, applicant HTTP routes, privileged moderation and live capability resolution are implemented. Approval activates a TrainerProfile without changing the account role; revocation removes trainer access through current persisted capability checks. Trainer Web has protected login and workspace routes. This is not production or full Trainer migration approval. See [ADR-005](../../architecture/adr-005-product-ownership-trainer-migration.md), [Users capabilities](users.md) and the [Trainer Web guide](../../../apps/trainer/README.md).

## Data model

- `TrainerApplication` keeps a per-user submission history with `PENDING → APPROVED | REJECTED` and `APPROVED → REVOKED` transitions. Reapplication after a terminal decision creates **another row**, never rewrites an old decision.
- A partial PostgreSQL unique index enforces at most **one pending** application per user, even under concurrent requests.
- Each terminal decision must include `reviewerId` and `reviewedAt`; `REVOKED` also requires `revokedAt`. The database rejects malformed states.
- `TrainerProfile` is one-to-one with `User`, starts with `isActive = false`, and can be activated only together with an approval actor/time. On revoke it returns to inactive with a revocation timestamp/actor.
- A pending application or inactive profile does not grant trainer capability. The current persisted active profile and legacy compatibility rules determine capability; every protected operation still requires its own authorization and ownership checks. #311 implements transactional review; do not expose internal DB writes directly via HTTP.
- Restrictive foreign keys preserve audit references. No legacy trainer records are migrated or activated automatically; this is additive.

## Test and rollout gates

- Generated Prisma Client and schema validation: `pnpm --filter @gym/api db:generate` and `pnpm --filter @gym/api db:validate`.
- Pure transition tests: `pnpm --filter @gym/api test`.
- PostgreSQL integration uses the disposable `*_test` database and verifies unique pending rows, failed malformed approval, review history, no athlete role mutation, and fail-closed profile activation. Never run this migration on production without staging review.
- Use standard `pnpm --filter @gym/api db:migrate:deploy` **only** on a verified disposable test database or separately approved staging environment. Frozen initial baseline is unchanged.
- Related delivered slices include #310 submission/status, #311 operator moderation, #312 dashboard read models and #363 Trainer Web authentication. Use the current roadmap for remaining migration and rollout gates.

## Application HTTP API — #310

The authenticated applicant uses the same User identity, browser session cookie
or Bearer access token as the existing API. The three routes are **owner-only**:

- `POST /trainer-applications` — 201, new own PENDING record; 3/min/IP.
- `GET /trainer-applications/me` — 200, `{ application: record | null }`; 60/min/IP.
- `PATCH /trainer-applications/me` — 200, edit own PENDING record; 3/min/IP.

POST and PATCH accept only `{ "applicantNote": "20–1000 characters" }`.
Zod rejects extra fields including `role`, `status`, `userId`, `reviewerId`
and all approval timestamps. Only verified-email ATHLETE accounts without an active TrainerProfile may
submit/edit. Submission conflicts (409) if a pending or approved application exists; editing requires an own pending application and conflicts if it is no longer pending. Rejected or revoked
applications remain in the audit history and allow another submission. The
PostgreSQL partial unique index prevents concurrent duplicate PENDING rows.

GET does not reveal other accounts' applications or reviewer identity.
Read/write responses contain only applicant-facing fields, and the entire
`/trainer-applications` tree sets `Cache-Control: no-store` including errors.
Applicant endpoints do not grant Trainer capability. The separate operator moderation flow below changes the profile, and live capability resolution governs subsequent access.

Tests: `src/modules/trainer-onboarding/test/`,
`test/e2e/trainer-onboarding/`. The checked-in OpenAPI and typed client must
be regenerated with `pnpm api:contract:generate` alongside route changes.

## Operator moderation HTTP API — #311

**Elevation:** Only an existing `ADMIN` account explicitly included in
`SUPERADMIN_USER_IDS` can call `admin.accounts.manage`. Each route requires an Admin-purpose browser session using the dedicated Admin cookie provider, Admin origin guard and session-purpose guard. A bearer token or ordinary browser session alone is insufficient. The service checks the existing
`admin.accounts.manage` permission and the live database role. This avoids
Nest's global permission guard running before the route's auth guard.
Default ADMIN, TRAINER, ATHLETE and anonymous callers remain denied; reviews
also validate the live administrator role inside the serializable transaction.

- `GET /admin/trainer-applications`: up to 50 oldest pending submissions.
- `POST /admin/trainer-applications/:id/approve`: activate an approved
  `TrainerProfile`, preserving the user's ATHLETE role.
- `POST /admin/trainer-applications/:id/reject`: record a reviewed rejection
  without creating or activating a profile.
- `POST /admin/trainer-applications/:id/revoke`: deactivate the profile and
  audit the actor, time and separate revocation reason.

Each decision has strict `{ "reason": "8–500 characters" }` validation;
unknown fields, self-moderation, stale state and attempts to change another
administrator's decision are rejected. An identical request from the same
operator is idempotent. Decisions and profile changes use one PostgreSQL
`SERIALIZABLE` transaction. `P2034` serialization conflicts and `P2002` uniqueness conflicts return 409.
The approval and revocation reasons are stored separately; the additive
`revoke_reason` migration leaves legacy rows compatible.

Approval and revocation do not change `User.role` or grant moderator privileges. Current capability resolution reads persisted role and TrainerProfile state, not stale token claims. Revocation denies trainer access while preserving athlete capability for eligible accounts. Trainer Web authentication and workspace routes exist; protected operations must continue to enforce current server-side grants and resource ownership. No production rollout is authorized.
