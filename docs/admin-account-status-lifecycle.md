# Admin account suspension — gated rollout plan (#293)

**Status: policy and DTO contract only. Not an enabled API feature.** This
initial slice introduces no new route, database migration, UI action or
authentication behavior. Production account suspension must remain disabled
until the later security gates below have passed.

## Current system and threat model

- `User` has `deletedAt`, but no persisted `ACTIVE / SUSPENDED` status.
  Soft deletion is not suspension and must remain separate.
- Cookie sessions are stored in `sessions`; native credentials use JWT
  bearer access tokens, refresh-token families and refresh tokens.
- Session/JWT authentication validates a user through `findUserById`, but
  current repository and credential-token lookups check only `deletedAt`.
- A status-only database write would **not** revoke existing sessions,
  refresh tokens or issued JWTs. Therefore do not expose a suspend button,
  route or privileged admin mutation yet.
- `SUPERADMIN_USER_IDS` is an operator bootstrap allowlist, not a database
  role table. The actual authorization also requires the current persisted
  `ADMIN` role. It must never be taken from a client-supplied role claim.

## Policy and command contract in this PR

`decideLockedAccountStatusTransition` and
`adminAccountStatusCommandSchema` are reusable prerequisites for a future
server-side mutation service. **Neither executes or exposes a mutation.**

- Explicit `admin.accounts.manage` authorization is checked before any
  transition *or no-op*; an ordinary `ADMIN` cannot use it.
- `SUSPEND` refuses the caller's own account and **every allowlisted operator
  UUID**, not merely the last one. This conservative policy prevents last
  Super Admin lockout without relying on a racy count in the current
  configuration-only operator model.
- A same-target-status retry is an idempotent no-op. A different transition
  with a stale `expectedStatus` receives a conflict. This assumes the input
  is a freshly locked database snapshot, not stale browser state.
- Future command bodies are strict: `expectedStatus: ACTIVE | SUSPENDED`
  and a trimmed reason of 8–500 characters with no control characters.
  The target is a validated UUID. Never log raw reasons or account data.
- Account status is distinct from role, trainer approval, email verification
  and soft deletion. No new `SUPERADMIN` role is introduced here.

## Required implementation slices before suspend/reactivate can be enabled

1. **Persist state and close *every* authentication path.** Add an
   `AccountStatus` enum and default-`ACTIVE` migration, update operator
   read projections, and reject suspended principals in cookie sessions,
   JWT validation, password login, refresh rotation, token issuance,
   capability checks and any background auth paths. Test that an existing
   JWT cannot be used once suspended. Audit all paths in `apps/api` before
   claiming completeness; changing only `findUserById` is insufficient.
2. **Atomic command/revocation boundary.** In a PostgreSQL transaction,
   serialize account status changes and *all concurrent session / refresh
   token creation* on a common user-row lock. Recheck the current actor's
   persisted role and allowlist and the target's persisted status under the
   lock. Call the policy with that locked snapshot. On suspension atomically
   change the status, delete all sessions, revoke refresh-token families
   **and** refresh-token rows, and prevent new tokens being written after
   revocation. A racing login/refresh must not escape the boundary. Retries,
   401/403/404/409 errors and cross-node concurrency require HTTP + real
   PostgreSQL E2E, including an attempted operator lockout.
3. **Audit and operational recovery.** The existing `AdminAuditLogger` is
   logging-only and **not durable evidence**. Agree a durable append-only
   audit strategy, operator attribution and safe reason handling before
   enabling privileged writes in production. Make the recovery path explicit
   if the operator allowlist is accidentally emptied.
4. **Expose and test endpoints, then UI.** Only after the above gates,
   add tightly scoped suspend/reactivate HTTP handlers and Admin confirmation
   flows. Verify frontend authorization, invalidation of cached user data,
   no-store responses, real host-only cookies, HTTPS, CSRF and staging
   device/browser behavior. No state-changing links or GET mutations.

## Acceptance for this foundation PR

- Pure policy denies unauthorized / self / any operator suspension, and
  distinguishes successful changes, idempotent no-ops and stale conflicts.
- Strict command schema rejects unknown keys, invalid IDs, whitespace-only
  reasons, excessive reasons and control characters.
- CI verifies unit/type/lint/architecture gates, with no Prisma migration,
  OpenAPI change, new endpoint or production behavior.

This PR **does not close #293**. Each remaining gate is a separate, small,
reviewed PR. The repository owner merges manually after CI is green.
