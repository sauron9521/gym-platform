# Trainer onboarding schema and approval lifecycle (M05 / #309)

**Current status:** schema and persistence foundation only. **No HTTP endpoints or Trainer capability grants are introduced by this PR.** Existing `User.role`, `/users/me`, sessions, trainer-athlete links, and current Athlete workouts are unchanged. See [ADR-005](../../architecture/adr-005-product-ownership-trainer-migration.md).

## Data model

- `TrainerApplication` keeps a per-user submission history with `PENDING → APPROVED | REJECTED` and `APPROVED → REVOKED` transitions. Reapplication after a terminal decision creates **another row**, never rewrites an old decision.
- A partial PostgreSQL unique index enforces at most **one pending** application per user, even under concurrent requests.
- Each terminal decision must include `reviewerId` and `reviewedAt`; `REVOKED` also requires `revokedAt`. The database rejects malformed states.
- `TrainerProfile` is one-to-one with `User`, starts with `isActive = false`, and can be activated only together with an approval actor/time. On revoke it returns to inactive with a revocation timestamp/actor.
- A profile or an application alone **does not grant permissions**. #291 must define cross-product capability/read rules and #311 must perform protected, idempotent, audited approval/revocation transactions. Do not expose internal DB writes directly via HTTP.
- Restrictive foreign keys preserve audit references. No legacy trainer records are migrated or activated automatically; this is additive.

## Test and rollout gates

- Generated Prisma Client and schema validation: `pnpm --filter @gym/api db:generate` and `pnpm --filter @gym/api db:validate`.
- Pure transition tests: `pnpm --filter @gym/api test`.
- PostgreSQL integration uses the disposable `*_test` database and verifies unique pending rows, failed malformed approval, review history, no athlete role mutation, and fail-closed profile activation. Never run this migration on production without staging review.
- Use standard `pnpm --filter @gym/api db:migrate:deploy` **only** on a verified disposable test database or separately approved staging environment. Frozen initial baseline is unchanged.
- Follow-up API work is split across #310 submission/status, #311 admin moderation + capability synchronization, #312 dashboard read models and #363 Trainer Web auth after permissions.

## Application HTTP API — #310

The authenticated applicant uses the same User identity, browser session cookie
or Bearer access token as the existing API. The three routes are **owner-only**:

- `POST /trainer-applications` — 201, new own PENDING record; 3/min/IP.
- `GET /trainer-applications/me` — 200, `{ application: record | null }`; 60/min/IP.
- `PATCH /trainer-applications/me` — 200, edit own PENDING record; 3/min/IP.

POST and PATCH accept only `{ "applicantNote": "20–1000 characters" }`.
Zod rejects extra fields including `role`, `status`, `userId`, `reviewerId`
and all approval timestamps. Only verified-email ATHLETE accounts may
submit/edit; pending or approved requests conflict (409). Rejected or revoked
applications remain in the audit history and allow another submission. The
PostgreSQL partial unique index prevents concurrent duplicate PENDING rows.

GET does not reveal other accounts' applications or reviewer identity.
Read/write responses contain only applicant-facing fields, and the entire
`/trainer-applications` tree sets `Cache-Control: no-store` including errors.
No endpoint grants Trainer capability; moderation (#311), role/capability
policy (#291) and Trainer Web authorization (#363) are separate milestones.

Tests: `src/modules/trainer-onboarding/test/`,
`test/e2e/trainer-onboarding/`. The checked-in OpenAPI and typed client must
be regenerated with `pnpm api:contract:generate` alongside route changes.

## Operator moderation HTTP API — #311

**Elevation:** Only an existing `ADMIN` account explicitly included in
`SUPERADMIN_USER_IDS` can call `admin.accounts.manage`. The permission
guard also denies default ADMIN, TRAINER, ATHLETE and anonymous requests.
The service rechecks the live database role inside the transaction.

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
`SERIALIZABLE` transaction. `P2034` concurrent conflicts return 409.
The approval and revocation reasons are stored separately; the additive
`revoke_reason` migration leaves legacy rows compatible.

The new approved profile facet does not change `User.role`, session tokens,
existing Trainer/Athlete guards, or grant moderator privileges. Consumer-side
capability resolution and session authorization changes remain in #291/#361,
then Trainer Web routes #363. Do not claim Trainer Web access is unlocked yet.
