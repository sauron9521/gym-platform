# Administrative audit stream — foundation

`AdminAuditLogger` is an injectable, structured event emitter for future `admin.*` controller actions. It validates the permission registry, records allowed/denied/failed outcomes, hashes identifiers and rejects unsafe request IDs. Never send raw email addresses, credentials, payloads, SQL or exception objects to this logger.

**Not yet a durable audit log.** The current API has no administrative write controller calling this service, and application logs may be lost, rotated or altered. Do **not** claim immutable or complete auditability. A future migration must add an append-only persistent table with defined retention, actor/target linkage, integrity checks and access rules. That change depends on first modernizing the baseline-only Prisma migration verifier.

Manual verification is required for log shipping, retention, access restrictions and alert delivery before actual admin roles/exercise moderation may run in production.
