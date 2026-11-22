# Internal atomic account-status revocation — Issue #293

This slice adds an injectable **server-side transactional primitive**, not
HTTP routes, UI actions, or externally usable mutation permissions. Durable
audit and security approval remain mandatory before exposing these operations.

## Transactional rules

The AdminAccountStatusService locks the persisted operator and target account
rows in stable UUID order, rechecks the current ADMIN role and trusted
allowlist, and invokes the existing transition policy with the locked target
snapshot. A missing/deleted target is 404; an unauthorized operator is
rejected before target lookup; stale transitions conflict; idempotent retries
require the same authorization. No application role or client status is
trusted without a fresh database read.

Both SUSPEND and REACTIVATE update the persisted status and authentication
revocation fence, delete all cookie sessions, mark refresh families revoked,
and mark refresh tokens revoked in **one PostgreSQL interactive transaction**.
A failure rolls back every write. In particular, a legacy/manual
SUSPENDED row cannot resurrect lingering credentials when reactivated.

Both session insertion and refresh-token insertion acquire a PostgreSQL
FOR UPDATE lock on the same users row **inside their insert transactions**.
Refresh-token inserts always acquire the user lock before a family row lock,
matching the status transition's ordering. Either credential issuance wins
first and is removed/revoked by SUSPEND, or SUSPEND wins and issuance fails.
This is tested on real PostgreSQL using concurrent requests.

## Stateless JWT fence

The nullable authInvalidatedAt column defaults to NULL, preserving current
tokens for existing users. After any transition, signed JWT iat must be
strictly later than the persisted fence. JWT iat is seconds-granular while
the fence has millisecond precision: an issued JWT in the same second is
deliberately denied. Newly authenticated users may need to issue a token
a second after reactivation. The field never leaves public API projections.

## Deliberate limitations

No state-changing Admin HTTP controller is added in this PR. The primitive
cannot be accessed by a browser and must **not be exposed** until an
append-only durable audit record (including sanitized reason, operator,
target, before/after states and timestamps) is written in the **same**
transaction. Additional rollout gates: explicit rate limiting, CSRF,
security review, confirmation UX, staged device/browser auth checks, and
incident recovery for lost operator allowlists. The existing logger alone
is not sufficient durable audit evidence.

The exact test commands, acceptance criteria and risk notes remain in
docs/admin-account-status-lifecycle.md. Keep #293 open for remaining
durable audit, authorization HTTP endpoints and UI.
