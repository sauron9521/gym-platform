# Admin account suspension — gated rollout plan (#293)

**Status: policy, persisted state, auth gates, and an internal atomic
revocation primitive.** The foundation policy (#598) remains pure, while
status gates and read-only operator status display were added in #600.
The next slice adds transactionally locked state changes, credential
revocation, and JWT invalidation fencing. **No suspend/reactivate HTTP
endpoint or write UI is enabled.** Durable audit and staging security gates
still prevent public or production use.

## Current system and threat model

- `User.status` is now `AccountStatus` (`ACTIVE` by default or `SUSPENDED`);
  historical users migrate safely to `ACTIVE`. Soft deletion remains separate.
- Cookie sessions are stored in `sessions`; native credentials use JWT
  bearer access tokens, refresh-token families and refresh tokens.
- Session/JWT authentication validates a user through `findUserById`;
  the repository and credential-token stores now independently require
  persisted `ACTIVE` and non-deleted state on every read. Login, JWT,
  cookie sessions, refresh reads/mark-used and credential creation gates
  are denied for suspended accounts. Read-only Admin list/detail shows
  persisted status, including `SUSPENDED`.
- A status-only database write would **not** revoke existing sessions,
  refresh tokens or issued JWTs. The internal transition now revokes all
  three credential types in one transaction, but it is **not** HTTP
  accessible until the durable audit and browser security gates are met.
- `SUPERADMIN_USER_IDS` is an operator bootstrap allowlist, not a database
  role table. The actual authorization also requires the current persisted
  `ADMIN` role. It must never be taken from a client-supplied role claim.

## Policy and command contract in this PR

`decideLockedAccountStatusTransition` and
`adminAccountStatusCommandSchema` are reusable prerequisites for a future
server-side mutation service. **Neither executes or exposes a mutation.**

- Explicit `admin.accounts.manage` authorization is checked before any
  transition _or no-op_; an ordinary `ADMIN` cannot use it.
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

1. **Completed in this slice: persisted state and authentication reads.**
   `AccountStatus` enum, default-`ACTIVE` migration, real operator read
   projections, cookie/JWT/credential/refresh gates, and direct PostgreSQL
   E2E verifying old cookie/JWT/refresh and fresh logins are denied. These
   checks prevent ordinary use while suspended, but are **not** a substitute
   for atomic revocation before enabling the future mutation command.
2. **Internal atomic command/revocation boundary implemented.** The
   PostgreSQL transaction locks both actor and target records, rechecks
   privileges and target state, and applies the policy. On suspension,
   it changes status and advances the JWT revocation fence; on both SUSPEND
   and REACTIVATE it deletes sessions, revokes refresh families and marks
   refresh tokens revoked atomically. Reactivation cannot resurrect old
   access tokens or leftover credentials from legacy suspended accounts. All session/refresh writes lock the same user row before
   inserting. Real PostgreSQL E2E exercises successful revocation, old JWT
   invalidation after reactivation, idempotency, conflicts, operator lockout,
   and credential-insert races. See the separate
   docs/admin-atomic-account-revocation.md. No HTTP command exists yet.
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

## Rollout acceptance and outstanding gates

- Pure policy denies unauthorized / self / any operator suspension, and
  distinguishes successful changes, idempotent no-ops and stale conflicts.
- Strict command schema rejects unknown keys, invalid IDs, whitespace-only
  reasons, excessive reasons and control characters.
- CI verifies unit/type/lint/architecture gates and real PostgreSQL tests.
  The internal transaction now revokes credentials permanently and advances
  the JWT fence, **but no state-changing route or Admin UI exists yet**.
  Required next: durable audit in the same transaction and staging HTTP/
  browser security validation before enabling public administrative writes.

This PR **does not close #293**. Each remaining gate is a separate, small,
reviewed PR. The repository owner merges manually after CI is green.
