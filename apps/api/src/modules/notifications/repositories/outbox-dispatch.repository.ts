import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  isProgramAssignmentEvent,
  isTrainerReviewEvent,
  outboxEventKey,
  outboxEventSchema,
} from '../domain/outbox-event.policy.js';
import {
  OUTBOX_LEASE_MS,
  OUTBOX_MAX_ATTEMPTS,
  outboxRetryDelayMs,
} from '../domain/outbox-dispatch.policy.js';

import { dispatchAdminReviewNotification } from './dispatch-admin-review-notification.js';
import { resolveReviewNotification } from './resolve-review-notification.js';
import { resolveProgramNotification } from './resolve-program-notification.js';
import { resolveTrainerNotification } from './resolve-trainer-notification.js';

type Claim = {
  id: string;
  attemptCount: number;
  leaseUntil: Date | null;
  status: 'PROCESSING' | 'DEAD_LETTER';
};
export type DispatchResult = 'processed' | 'skipped' | 'dead_letter' | 'lease_lost' | 'retry';

@Injectable()
export class OutboxDispatchRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  async claim(): Promise<Claim | null> {
    // One row per claim; no process-local coordination or external queue.
    // PostgreSQL time avoids inconsistent lease expiry across replicas.
    const [row] = await this.prisma.$queryRaw<Claim[]>`
      WITH candidate AS (
        SELECT id FROM outbox_events
        WHERE (status = 'PENDING' AND available_at <= statement_timestamp())
          OR (status = 'PROCESSING' AND (lease_until IS NULL OR lease_until <= statement_timestamp()))
        ORDER BY available_at, id
        LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events AS e
      SET status = CASE WHEN e.attempt_count >= ${OUTBOX_MAX_ATTEMPTS}
            THEN 'DEAD_LETTER'::"OutboxEventStatus" ELSE 'PROCESSING'::"OutboxEventStatus" END,
          attempt_count = CASE WHEN e.attempt_count >= ${OUTBOX_MAX_ATTEMPTS}
            THEN e.attempt_count ELSE e.attempt_count + 1 END,
          lease_until = CASE WHEN e.attempt_count >= ${OUTBOX_MAX_ATTEMPTS}
            THEN NULL ELSE date_trunc('milliseconds', statement_timestamp()) + ${OUTBOX_LEASE_MS} * interval '1 millisecond' END,
          last_attempt_at = CASE WHEN e.attempt_count >= ${OUTBOX_MAX_ATTEMPTS}
            THEN e.last_attempt_at ELSE statement_timestamp() END,
          last_error_code = CASE WHEN e.attempt_count >= ${OUTBOX_MAX_ATTEMPTS}
            THEN 'ATTEMPTS_EXHAUSTED' ELSE e.last_error_code END
      FROM candidate WHERE e.id = candidate.id
      RETURNING e.id, e.attempt_count AS "attemptCount", e.lease_until AS "leaseUntil", e.status::text AS status
    `;
    return row ?? null;
  }

  async process(claim: Claim): Promise<DispatchResult> {
    if (claim.status !== 'PROCESSING' || !claim.leaseUntil) return 'lease_lost';
    return this.prisma.$transaction(
      async (tx) => {
        // Fence stale workers by both attempt and lease. Keep the lock until
        // Inbox persistence and the outbox state commit together.
        const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM outbox_events
        WHERE id = ${claim.id} AND status = 'PROCESSING'
          AND attempt_count = ${claim.attemptCount} AND lease_until = ${claim.leaseUntil}
          AND lease_until > clock_timestamp()
        FOR UPDATE
      `;
        if (!locked.length) return 'lease_lost';
        const row = await tx.outboxEvent.findUniqueOrThrow({ where: { id: claim.id } });
        const parsed = outboxEventSchema.safeParse({
          type: row.type,
          schemaVersion: row.schemaVersion,
          occurredAt: row.occurredAt,
          actorUserId: row.actorUserId,
          payload: row.payload,
        });
        if (!parsed.success || row.eventKey !== outboxEventKey(parsed.data)) {
          return this.finish(tx, claim.id, 'INVALID_EVENT', 'dead_letter');
        }
        const event = parsed.data;
        if (event.type === 'admin.trainer.review.required') {
          const result = await dispatchAdminReviewNotification(
            tx,
            claim.id,
            event,
            this.config?.get('SUPERADMIN_USER_IDS'),
          );
          return this.finish(tx, claim.id, result.code, result.result);
        }
        let recipientId: string;
        let trainerRelationshipId: string | null = null;
        let programAssignmentId: string | null = null;
        let trainerApplicationId: string | null = null;
        let category: 'ACCOUNT' | 'TRAINER' | 'PROGRAM';
        if (event.type === 'account.security.changed') {
          // Re-read authoritative source. Never use actor or client data alone
          // to select a recipient. The audit record is immutable.
          const audit = await tx.mfaLifecycleAudit.findUnique({
            where: { id: event.payload.aggregate.id },
          });
          if (
            !audit ||
            audit.userId !== event.payload.context.userId ||
            audit.action !== event.payload.context.action ||
            audit.occurredAt.getTime() !== event.occurredAt.getTime()
          ) {
            return this.finish(tx, claim.id, 'SOURCE_MISMATCH', 'dead_letter');
          }
          // Serialize the eligibility check against account suspension/deletion.
          const owners = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id = ${audit.userId}
          AND status = 'ACTIVE' AND deleted_at IS NULL FOR SHARE
      `;
          if (!owners.length) return this.finish(tx, claim.id, 'RECIPIENT_INELIGIBLE', 'skipped');
          recipientId = audit.userId;
          category = 'ACCOUNT';
        } else if (isTrainerReviewEvent(event)) {
          const resolved = await resolveReviewNotification(tx, event);
          if (resolved.result !== 'resolved')
            return this.finish(tx, claim.id, resolved.code, resolved.result);
          recipientId = resolved.recipientId;
          trainerApplicationId = resolved.trainerApplicationId;
          category = 'ACCOUNT';
        } else if (isProgramAssignmentEvent(event)) {
          const resolved = await resolveProgramNotification(tx, event);
          if (resolved.result !== 'resolved')
            return this.finish(tx, claim.id, resolved.code, resolved.result);
          recipientId = resolved.recipientId;
          programAssignmentId = resolved.programAssignmentId;
          category = 'PROGRAM';
        } else {
          const resolved = await resolveTrainerNotification(tx, event);
          if (resolved.result !== 'resolved')
            return this.finish(tx, claim.id, resolved.code, resolved.result);
          recipientId = resolved.recipientId;
          trainerRelationshipId = resolved.trainerRelationshipId;
          category = 'TRAINER';
        }

        const inserted = await tx.notification.createMany({
          data: {
            eventId: claim.id,
            recipientId,
            scope: 'USER',
            type: event.type,
            category,
            templateKey: event.type,
            trainerRelationshipId,
            programAssignmentId,
            trainerApplicationId,
          },
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          const existing = await tx.notification.findUnique({
            where: {
              eventId_recipientId_scope: {
                eventId: claim.id,
                recipientId,
                scope: 'USER',
              },
            },
            select: {
              type: true,
              category: true,
              templateKey: true,
              resourceType: true,
              resourceId: true,
              trainerRelationshipId: true,
              programAssignmentId: true,
              trainerApplicationId: true,
            },
          });
          if (
            !existing ||
            existing.type !== event.type ||
            existing.category !== category ||
            existing.templateKey !== event.type ||
            existing.trainerRelationshipId !== trainerRelationshipId ||
            existing.programAssignmentId !== programAssignmentId ||
            existing.trainerApplicationId !== trainerApplicationId ||
            existing.resourceType !== null ||
            existing.resourceId !== null
          ) {
            return this.finish(tx, claim.id, 'INBOX_CONFLICT', 'dead_letter');
          }
        }
        return this.finish(tx, claim.id, null, 'processed');
      },
      { timeout: 10_000 },
    );
  }

  private async finish(
    tx: Prisma.TransactionClient,
    id: string,
    code: string | null,
    result: 'processed' | 'skipped' | 'dead_letter',
  ): Promise<DispatchResult> {
    await tx.outboxEvent.update({
      where: { id },
      data: {
        status: result === 'dead_letter' ? 'DEAD_LETTER' : 'PROCESSED',
        processedAt: result === 'dead_letter' ? null : new Date(),
        leaseUntil: null,
        lastErrorCode: code,
      },
    });
    return result;
  }

  async retry(claim: Claim): Promise<DispatchResult> {
    if (claim.status !== 'PROCESSING' || !claim.leaseUntil) return 'lease_lost';
    const exhausted = claim.attemptCount >= OUTBOX_MAX_ATTEMPTS;
    const delay = outboxRetryDelayMs(claim.attemptCount);
    // Never let a late failure overwrite a reclaimed or committed event.
    const count = await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = ${exhausted ? 'DEAD_LETTER' : 'PENDING'}::"OutboxEventStatus",
          available_at = statement_timestamp() + ${delay} * interval '1 millisecond',
          lease_until = NULL, last_error_code = 'PROCESSING_FAILED'
      WHERE id = ${claim.id} AND status = 'PROCESSING'
        AND attempt_count = ${claim.attemptCount} AND lease_until = ${claim.leaseUntil}
        AND lease_until > clock_timestamp()
    `;
    return count === 0 ? 'lease_lost' : exhausted ? 'dead_letter' : 'retry';
  }
}
