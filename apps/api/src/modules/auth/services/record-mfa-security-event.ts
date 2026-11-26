import type { MfaLifecycleAction, Prisma } from '#prisma/client';
import { publishOutboxEvent } from '#src/modules/notifications/public-api';

type SecurityNoticeAction = Exclude<MfaLifecycleAction, 'ADMIN_TOTP_CHALLENGE_VERIFIED'>;

/**
 * Called only inside the existing owner-locked lifecycle transaction.
 * The audit ID identifies the committed transition, not a request or time.
 * The outbox has no recipient address, raw proof, secret or transport data.
 */
export async function recordMfaSecurityEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  action: SecurityNoticeAction,
): Promise<void> {
  const audit = await tx.mfaLifecycleAudit.create({ data: { userId, action } });
  await publishOutboxEvent(tx, {
    type: 'account.security.changed',
    schemaVersion: 1,
    occurredAt: audit.occurredAt,
    actorUserId: userId,
    payload: {
      aggregate: { kind: 'MfaLifecycleAudit', id: audit.id },
      context: { userId, action },
    },
  });
}
