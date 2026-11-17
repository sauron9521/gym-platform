# Admin audit events — structured logging foundation

**Status:** event validation and best-effort application logging only.
There is NO durable append-only audit table, no integrity guarantee, no
retention/replication policy, and no active admin write endpoint using
this service yet. **Do not use app logs as compliance or production
authorization evidence.**

## Using the foundation

`AdminAuditModule` exports `AdminAuditLogger` as a Nest provider.
Future admin feature modules must explicitly import `AdminAuditModule`
to inject it. Merely registering the module in `AppModule` does not make
its exported providers globally accessible.

`record({ permission, actorId, targetId?, outcome }, request?)` accepts a
**server-verified principal** UUID, optional valid target UUID, a known
`ADMIN_PERMISSIONS` entry and `allowed | denied | failed` outcome.
Runtime Zod validation rejects unknown or extra fields, including
caller-provided request IDs, messages, emails and error objects.
No endpoint is connected to `record` in this PR.

Actor/target identifiers are replaced by deterministic, domain-separated
SHA-256 hashes. These are **pseudonyms, not anonymization**: they may be
re-identified when an original UUID is known. Treat the logs as sensitive.
For future persistent events, use a reviewed, key-managed HMAC/pseudonym
strategy that supports retention and key rotation.

If the optional Express `request` is supplied, a correlation ID is
taken exclusively from the server-generated private request-context symbol
using `getRequestId`. Client-provided `X-Request-ID` or an arbitrary
`requestId` parameter is never included.

## Production audit system — separate reviewed work

1. Create an append-only persistent store via a reviewed Prisma migration
   and narrow write/read permissions; do not allow record mutation by app
   roles or ordinary database users.
2. Define actor and target linkage, timestamps, permission and outcome
   semantics, retention periods, compliance/legal review, HMAC key handling
   and redaction requirements.
3. Record high-risk changes transactionally where possible, including
   denied attempts where appropriate; define fail-closed behavior on
   persistence failure.
4. Verify multi-replica ingestion, tamper detection, authenticated access,
   audit dashboards, alerting, archive and rollback in staging.

Logging a `denied` or `failed` outcome is not proof that a request was
blocked. Authorization must be enforced by `PermissionsGuard` and the
domain layer; audit and enforcement are separate responsibilities.
