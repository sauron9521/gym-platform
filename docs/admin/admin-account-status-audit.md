# Account status audit foundation — #293

**Status:** internal-only; no privileged HTTP mutation endpoint or Admin UI action enabled.

A successful change of account status writes exactly one immutable
`admin_account_status_audit` row in the **same PostgreSQL transaction** as
`users.status`, the JWT invalidation fence, cookie-session removal, and
refresh token/family revocation. If the insert fails, all status and credential
writes roll back. Authorized idempotent no-op retries emit no extra event;
denied/stale operations emit no success event. This is a _change history_, not
an attempted-access log; failed/denied attempts require a separately designed
security telemetry stream.

Fields: event ID, actor user ID, target user ID, action, previous/new status,
required coded reason and DB timestamp. The reason is one of
`SECURITY`, `POLICY`, `USER_REQUEST`, or `ERROR_CORRECTION`;
free-form descriptions and ticket content are deliberately excluded to reduce
personal data and secret retention. Actor and target identifiers are retained
without FKs so that an account deletion does not erase historical evidence.
The table must be accessible only through narrowly authorized internal
consumers and must never be exposed in a public user payload.

The migration adds a direction CHECK and UPDATE/DELETE rejection trigger. The
trigger alone is **not cryptographic or administrator-proof immutability**:
the database owner can disable it or TRUNCATE data. Production hardening
requires separate least-privilege database roles (no UPDATE/DELETE/TRUNCATE),
protected backups, retention/deletion and privacy policy, integrity checks,
monitoring, and an incident recovery runbook. These are explicit follow-ups.

Before exposing an Admin mutation endpoint: enforce authenticated operator
session and step-up, fresh RBAC, CSRF protection, request origin validation,
rate limiting, strict Zod input, version/idempotency semantics, safe UI
confirmation, staging device/browser security tests, and operational rollback.
Do not close #293 or treat this foundation as authorization to enable actions.
