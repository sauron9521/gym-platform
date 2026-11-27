import { Injectable } from '@nestjs/common';
import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  DELIVERY_RETENTION_DAYS,
  INBOX_RETENTION_DAYS,
  RETENTION_BATCH_LIMIT,
  type RetentionMode,
  type RetentionResult,
} from '../domain/notification-retention.policy.js';

type Candidate = { id: string; eventId: string };
const inboxCutoff = Prisma.sql`statement_timestamp() - ${INBOX_RETENTION_DAYS} * interval '1 day'`;
const deliveryCutoff = Prisma.sql`statement_timestamp() - ${DELIVERY_RETENTION_DAYS} * interval '1 day'`;

// Explicit terminal allowlist, not a generic age-based deletion. The original
// processed event and its exact source identity must agree with the Inbox row.
function inboxCandidates(lock: boolean, ids?: string[]) {
  return Prisma.sql`
    SELECT n.id, e.id AS "eventId"
    FROM outbox_events e JOIN notifications n ON n.event_id = e.id
    WHERE e.status = 'PROCESSED' AND e.processed_at <= ${inboxCutoff}
      AND e.occurred_at <= ${inboxCutoff} AND e.lease_until IS NULL
      AND e.last_error_code IS NULL AND e.schema_version = 1
      AND e.inbox_retired_at IS NULL AND e.email_retired_at IS NULL
      AND n.scope = 'USER' AND n.created_at <= ${inboxCutoff}
      AND n.read_at <= ${inboxCutoff}
      AND n.type = e.type AND n.template_key = e.type
      AND n.trainer_application_id IS NULL AND n.resource_type IS NULL AND n.resource_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM notifications sibling WHERE sibling.event_id = e.id AND sibling.id <> n.id)
      AND NOT EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.notification_id = n.id)
      AND (
        (n.category = 'TRAINER' AND n.program_assignment_id IS NULL
          AND e.event_key = 'trainer-relationship:' || n.trainer_relationship_id || ':' || e.type || ':v1'
          AND e.payload = jsonb_build_object('aggregate', jsonb_build_object('kind', 'TrainerAthlete', 'id', n.trainer_relationship_id))
          AND EXISTS (SELECT 1 FROM trainer_athletes t WHERE t.id = n.trainer_relationship_id
            AND n.recipient_id IN (t.trainer_id, t.athlete_id)
            AND e.actor_user_id IN (t.trainer_id, t.athlete_id)
            AND e.actor_user_id <> n.recipient_id
            AND ((e.type = 'trainer.invitation.declined' AND t.status = 'DECLINED'
                AND t.initiated_by_id = n.recipient_id AND t.responded_at = e.occurred_at)
              OR (e.type = 'trainer.invitation.cancelled' AND t.status = 'CANCELLED'
                AND t.initiated_by_id = e.actor_user_id AND t.ended_by_id = e.actor_user_id AND t.ended_at = e.occurred_at)
              OR (e.type = 'trainer.relationship.terminated' AND t.status = 'TERMINATED'
                AND t.ended_by_id = e.actor_user_id AND t.ended_at = e.occurred_at))))
        OR
        (n.category = 'PROGRAM' AND n.trainer_relationship_id IS NULL
          AND e.event_key = 'program-assignment:' || n.program_assignment_id || ':' || e.type || ':v1'
          AND e.payload = jsonb_build_object('aggregate', jsonb_build_object('kind', 'TrainingProgramAssignment', 'id', n.program_assignment_id))
          AND EXISTS (SELECT 1 FROM training_program_assignments a WHERE a.id = n.program_assignment_id
            AND n.recipient_id = a.athlete_id
            AND ((e.type = 'program.assignment.completed' AND a.status = 'COMPLETED'
                AND a.athlete_id = e.actor_user_id AND a.completed_at = e.occurred_at)
              OR (e.type = 'program.assignment.cancelled' AND a.status = 'CANCELLED'
                AND a.assigned_by_id = e.actor_user_id AND a.ended_by_id = e.actor_user_id AND a.ended_at = e.occurred_at)
              OR (e.type = 'program.assignment.terminated' AND a.status = 'TERMINATED'
                AND e.actor_user_id IN (a.athlete_id, a.assigned_by_id)
                AND a.ended_by_id = e.actor_user_id AND a.ended_at = e.occurred_at))))
      )
    ${ids ? Prisma.sql`AND n.id IN (${Prisma.join(ids)})` : Prisma.empty}
    ORDER BY e.processed_at, e.id LIMIT ${RETENTION_BATCH_LIMIT}
    ${lock ? Prisma.sql`FOR UPDATE OF e, n SKIP LOCKED` : Prisma.empty}
  `;
}

function emailCandidates(lock: boolean, ids?: string[]) {
  return Prisma.sql`
    SELECT d.id, e.id AS "eventId"
    FROM outbox_events e JOIN notifications n ON n.event_id = e.id
      JOIN notification_deliveries d ON d.notification_id = n.id
    WHERE e.status = 'PROCESSED' AND e.processed_at <= ${deliveryCutoff}
      AND e.occurred_at <= ${deliveryCutoff} AND e.schema_version = 1
      AND e.lease_until IS NULL AND e.last_error_code IS NULL
      AND e.inbox_retired_at IS NULL AND e.email_retired_at IS NULL
      AND e.type = 'trainer.application.reviewed'
      AND n.scope = 'USER' AND n.category = 'ACCOUNT'
      AND n.type = e.type AND n.template_key = e.type
      AND n.trainer_relationship_id IS NULL AND n.program_assignment_id IS NULL
      AND n.resource_type IS NULL AND n.resource_id IS NULL
      AND e.event_key = 'trainer-application:' || n.trainer_application_id || ':' || e.type || ':v1'
      AND e.payload = jsonb_build_object('aggregate', jsonb_build_object('kind', 'TrainerApplication', 'id', n.trainer_application_id))
      AND EXISTS (SELECT 1 FROM trainer_applications a WHERE a.id = n.trainer_application_id
        AND a.user_id = n.recipient_id AND a.reviewer_id = e.actor_user_id
        AND a.reviewed_at = e.occurred_at AND a.status IN ('APPROVED', 'REJECTED')
        AND a.revoked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM notifications sibling WHERE sibling.event_id = e.id AND sibling.id <> n.id)
      AND d.channel = 'EMAIL' AND d.destination_key = 'account-email'
      AND d.status IN ('SENT', 'CANCELLED') AND d.finished_at <= ${deliveryCutoff}
      AND d.created_at <= ${deliveryCutoff} AND d.expires_at <= statement_timestamp()
      AND d.claim_token IS NULL AND d.lease_until IS NULL
    ${ids ? Prisma.sql`AND d.id IN (${Prisma.join(ids)})` : Prisma.empty}
    ORDER BY d.finished_at, d.id LIMIT ${RETENTION_BATCH_LIMIT}
    ${lock ? Prisma.sql`FOR UPDATE OF e, n, d SKIP LOCKED` : Prisma.empty}
  `;
}

@Injectable()
export class NotificationRetentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async run(mode: Exclude<RetentionMode, 'off'>): Promise<RetentionResult> {
    // Runtime fail closed even if the typed caller is bypassed.
    if (mode !== 'preview' && mode !== 'apply')
      throw new Error('Invalid notification retention mode');
    return this.prisma.$transaction(
      async (tx) => {
        const apply = mode === 'apply';
        if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '500ms'`;
        if (apply) {
          // Dedicated two-key namespace, transaction-scoped and replica-safe.
          const [lock] = await tx.$queryRaw<
            { acquired: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(1197030721, 579) AS acquired`;
          if (!lock?.acquired) return { mode, acquired: false, inbox: 0, email: 0 };
        }
        const inbox = await tx.$queryRaw<Candidate[]>(inboxCandidates(apply));
        const email = await tx.$queryRaw<Candidate[]>(emailCandidates(apply));
        if (apply) {
          if (inbox.length) {
            // Fresh READ COMMITTED snapshot after row locks: never cascade an
            // external delivery committed just before the parent was locked.
            const eligible = await tx.$queryRaw<Candidate[]>(
              inboxCandidates(
                false,
                inbox.map((row) => row.id),
              ),
            );
            if (eligible.length !== inbox.length)
              throw new Error('Inbox retention eligibility changed');
            const marked = await tx.$executeRaw`
            UPDATE outbox_events SET inbox_retired_at = statement_timestamp()
            WHERE id IN (${Prisma.join(inbox.map((row) => row.eventId))}) AND inbox_retired_at IS NULL
          `;
            const deleted = await tx.notification.deleteMany({
              where: { id: { in: inbox.map((row) => row.id) } },
            });
            if (marked !== inbox.length || deleted.count !== inbox.length)
              throw new Error('Inbox retention fence lost');
          }
          if (email.length) {
            const eligible = await tx.$queryRaw<Candidate[]>(
              emailCandidates(
                false,
                email.map((row) => row.id),
              ),
            );
            if (eligible.length !== email.length)
              throw new Error('Email retention eligibility changed');
            const marked = await tx.$executeRaw`
            UPDATE outbox_events SET email_retired_at = statement_timestamp()
            WHERE id IN (${Prisma.join(email.map((row) => row.eventId))}) AND email_retired_at IS NULL
          `;
            const deleted = await tx.notificationDelivery.deleteMany({
              where: { id: { in: email.map((row) => row.id) } },
            });
            if (marked !== email.length || deleted.count !== email.length)
              throw new Error('Email retention fence lost');
          }
        }
        return { mode, acquired: true, inbox: inbox.length, email: email.length };
      },
      {
        maxWait: 500,
        timeout: 10_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
