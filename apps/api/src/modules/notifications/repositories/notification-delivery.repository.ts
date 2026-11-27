import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  DELIVERY_LEASE_MS,
  DELIVERY_MAX_ATTEMPTS,
  DELIVERY_TTL_MS,
  EMAIL_DESTINATION,
  OPTIONAL_EMAIL_TYPE,
  QUIET_RECHECK_MS,
  type DeliveryOutcome,
  type EmailDestination,
} from '../domain/notification-delivery.policy.js';
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  quietHoursAt,
} from '../domain/notification-settings.policy.js';
import { outboxRetryDelayMs } from '../domain/outbox-dispatch.policy.js';

export type EmailClaim = { id: string; token: string };
type ClaimedRow = { id: string; status: 'CLAIMED' | 'CANCELLED' | 'UNKNOWN' };
type Eligibility =
  | ({ decision: 'allowed' | 'quiet'; consentedAt: Date; expiresAt: Date } & EmailDestination)
  | { decision: 'denied' };

export type EmailAdmission =
  | ({ kind: 'ready'; remainingMs: number } & EmailDestination)
  | 'deferred'
  | 'cancelled'
  | 'lease_lost';

async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
  return row!.now;
}

// Explicitly limited to the reviewed optional-email contract. No generic
// fallback from a category or an arbitrary notification to an address.
async function emailEligibility(
  tx: Prisma.TransactionClient,
  notificationId: string,
  now: Date,
): Promise<Eligibility> {
  const notification = await tx.notification.findUnique({
    where: { id: notificationId },
    select: {
      scope: true,
      type: true,
      category: true,
      templateKey: true,
      recipientId: true,
      trainerApplicationId: true,
      trainerRelationshipId: true,
      programAssignmentId: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  if (
    !notification ||
    notification.scope !== 'USER' ||
    notification.category !== 'ACCOUNT' ||
    notification.type !== OPTIONAL_EMAIL_TYPE ||
    notification.templateKey !== OPTIONAL_EMAIL_TYPE ||
    notification.resourceType !== null ||
    notification.resourceId !== null ||
    !notification.trainerApplicationId ||
    notification.trainerRelationshipId !== null ||
    notification.programAssignmentId !== null ||
    notification.createdAt > now
  )
    return { decision: 'denied' };
  const applications = await tx.$queryRaw<{ id: string; reviewedAt: Date }[]>`
    SELECT id, reviewed_at AS "reviewedAt" FROM trainer_applications
    WHERE id = ${notification.trainerApplicationId} AND user_id = ${notification.recipientId}
      AND status IN ('APPROVED','REJECTED') AND reviewed_at IS NOT NULL
      AND reviewed_at <= ${notification.createdAt} AND revoked_at IS NULL FOR SHARE
  `;
  const application = applications[0];
  if (!application) return { decision: 'denied' };
  // Lifetime and consent start at committed review time, not delayed dispatch.
  const expiresAt = new Date(
    Math.min(
      application.reviewedAt.getTime() + DELIVERY_TTL_MS,
      notification.expiresAt?.getTime() ?? Infinity,
    ),
  );
  if (expiresAt <= now) return { decision: 'denied' };
  const owners = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${notification.recipientId}
      AND status = 'ACTIVE' AND deleted_at IS NULL AND email_verified = true
      AND role <> 'ADMIN' FOR SHARE
  `;
  if (!owners.length) return { decision: 'denied' };
  const owner = await tx.user.findUniqueOrThrow({
    where: { id: notification.recipientId },
    select: {
      email: true,
      preferredLocale: true,
      profile: { select: { timezone: true } },
      notificationSettings: {
        select: {
          quietHoursEnabled: true,
          quietStartMinute: true,
          quietEndMinute: true,
          reminderLeadMinutes: true,
        },
      },
      notificationPreferences: {
        where: { category: 'ACCOUNT', channel: 'EMAIL' },
        select: { enabled: true, consentedAt: true },
      },
    },
  });
  if (!z.email().safeParse(owner.email).success) return { decision: 'denied' };
  const preference = owner.notificationPreferences[0];
  // Do not backfill events created before the current consent epoch.
  if (
    !preference?.enabled ||
    !preference.consentedAt ||
    preference.consentedAt > application.reviewedAt
  )
    return { decision: 'denied' };
  const evaluatedAt = await databaseNow(tx);
  if (expiresAt <= evaluatedAt) return { decision: 'denied' };
  const settings = notificationSettingsSchema.safeParse(
    owner.notificationSettings ?? defaultNotificationSettings,
  );
  if (!settings.success) return { decision: 'denied' };
  const quiet = quietHoursAt(evaluatedAt, owner.profile?.timezone ?? 'UTC', settings.data);
  if (quiet === 'invalid') return { decision: 'denied' };
  return {
    decision: quiet,
    consentedAt: preference.consentedAt,
    expiresAt,
    email: owner.email,
    locale: owner.preferredLocale === 'en' ? 'en' : 'uk',
  };
}

// The outbox calls this within its existing Inbox transaction. No SMTP here.
export async function planNotificationEmail(
  tx: Prisma.TransactionClient,
  notificationId: string,
): Promise<'planned' | 'existing' | 'ineligible'> {
  const now = await databaseNow(tx);
  const eligible = await emailEligibility(tx, notificationId, now);
  if (eligible.decision === 'denied') return 'ineligible';
  const result = await tx.notificationDelivery.createMany({
    data: {
      notificationId,
      channel: 'EMAIL',
      destinationKey: EMAIL_DESTINATION,
      consentedAt: eligible.consentedAt,
      expiresAt: eligible.expiresAt,
      availableAt: now,
    },
    skipDuplicates: true,
  });
  return result.count === 1 ? 'planned' : 'existing';
}

@Injectable()
export class NotificationDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async planEmail(notificationId: string) {
    return this.prisma.$transaction((tx) => planNotificationEmail(tx, notificationId));
  }

  async claimEmail(): Promise<
    { kind: 'claimed'; claim: EmailClaim } | { kind: 'terminal' } | null
  > {
    const token = randomUUID();
    // Expired SENDING is ambiguous: never turn it back into PENDING.
    const [row] = await this.prisma.$queryRaw<ClaimedRow[]>`
      WITH candidate AS (
        SELECT id FROM notification_deliveries WHERE channel = 'EMAIL'
          AND ((status = 'PENDING' AND (available_at <= statement_timestamp() OR expires_at <= statement_timestamp()))
            OR (status IN ('CLAIMED','SENDING') AND lease_until <= statement_timestamp()))
        ORDER BY available_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
      ), transition AS (
        SELECT d.id, CASE WHEN d.status = 'SENDING' THEN 'UNKNOWN'::"NotificationDeliveryStatus"
          WHEN d.expires_at <= statement_timestamp() THEN 'CANCELLED'::"NotificationDeliveryStatus"
          ELSE 'CLAIMED'::"NotificationDeliveryStatus" END AS next_status
        FROM notification_deliveries d JOIN candidate c ON c.id = d.id
      )
      UPDATE notification_deliveries d SET status = t.next_status,
        claim_token = CASE WHEN t.next_status = 'CLAIMED' THEN ${token} ELSE NULL END,
        lease_until = CASE WHEN t.next_status = 'CLAIMED'
          THEN date_trunc('milliseconds', statement_timestamp()) + ${DELIVERY_LEASE_MS} * interval '1 millisecond' ELSE NULL END,
        finished_at = CASE WHEN t.next_status = 'CLAIMED' THEN NULL ELSE statement_timestamp() END,
        last_error_code = CASE WHEN t.next_status = 'UNKNOWN' THEN 'SEND_OUTCOME_UNKNOWN'
          WHEN t.next_status = 'CANCELLED' THEN 'EXPIRED' ELSE d.last_error_code END
      FROM transition t WHERE d.id = t.id
      RETURNING d.id, d.status::text AS status
    `;
    if (!row) return null;
    return row.status === 'CLAIMED'
      ? { kind: 'claimed', claim: { id: row.id, token } }
      : { kind: 'terminal' };
  }

  private async locked(
    tx: Prisma.TransactionClient,
    claim: EmailClaim,
    status: 'CLAIMED' | 'SENDING',
  ) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM notification_deliveries WHERE id = ${claim.id}
        AND channel = 'EMAIL' AND status = ${status}::"NotificationDeliveryStatus"
        AND claim_token = ${claim.token} AND lease_until > clock_timestamp() FOR UPDATE
    `;
    return rows.length
      ? tx.notificationDelivery.findUniqueOrThrow({ where: { id: claim.id } })
      : null;
  }

  // Return only the freshly verified destination in memory, never persisted.
  // The caller must invoke the bounded transport immediately after commit.
  async beginSend(claim: EmailClaim): Promise<EmailAdmission> {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await this.locked(tx, claim, 'CLAIMED');
        if (!row) return 'lease_lost';
        const now = await databaseNow(tx);
        const eligible = await emailEligibility(tx, row.notificationId, now);
        const freshNow = await databaseNow(tx);
        if (!row.leaseUntil || row.leaseUntil <= freshNow) return 'lease_lost';
        const release = { claimToken: null, leaseUntil: null };
        if (
          row.expiresAt <= freshNow ||
          eligible.decision === 'denied' ||
          eligible.expiresAt <= freshNow ||
          eligible.consentedAt.getTime() !== row.consentedAt.getTime()
        ) {
          await tx.notificationDelivery.update({
            where: { id: row.id },
            data: {
              ...release,
              status: 'CANCELLED',
              finishedAt: freshNow,
              lastErrorCode: 'INELIGIBLE',
            },
          });
          return 'cancelled';
        }
        if (eligible.decision === 'quiet') {
          await tx.notificationDelivery.update({
            where: { id: row.id },
            data: {
              ...release,
              status: 'PENDING',
              availableAt: new Date(
                Math.min(
                  row.expiresAt.getTime(),
                  eligible.expiresAt.getTime(),
                  freshNow.getTime() + QUIET_RECHECK_MS,
                ),
              ),
              lastErrorCode: 'QUIET_HOURS',
            },
          });
          return 'deferred';
        }
        if (row.attemptCount >= DELIVERY_MAX_ATTEMPTS) {
          await tx.notificationDelivery.update({
            where: { id: row.id },
            data: {
              ...release,
              status: 'DEAD_LETTER',
              finishedAt: freshNow,
              lastErrorCode: 'ATTEMPTS_EXHAUSTED',
            },
          });
          return 'cancelled';
        }
        await tx.notificationDelivery.update({
          where: { id: row.id },
          data: {
            status: 'SENDING',
            attemptCount: { increment: 1 },
            lastAttemptAt: freshNow,
            leaseUntil: new Date(freshNow.getTime() + DELIVERY_LEASE_MS),
            lastErrorCode: null,
          },
        });
        return {
          kind: 'ready',
          email: eligible.email,
          locale: eligible.locale,
          remainingMs: Math.min(
            DELIVERY_LEASE_MS,
            row.expiresAt.getTime() - freshNow.getTime(),
            eligible.expiresAt.getTime() - freshNow.getTime(),
          ),
        };
      },
      { timeout: 10_000 },
    );
  }

  async complete(claim: EmailClaim, outcome: DeliveryOutcome): Promise<'recorded' | 'lease_lost'> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.locked(tx, claim, 'SENDING');
      if (!row) return 'lease_lost';
      const now = await databaseNow(tx);
      if (!row.leaseUntil || row.leaseUntil <= now) return 'lease_lost';
      const base = { claimToken: null, leaseUntil: null };
      let data: Prisma.NotificationDeliveryUpdateInput;
      if (outcome === 'accepted')
        data = { ...base, status: 'SENT', finishedAt: now, lastErrorCode: null };
      else if (
        outcome === 'not_sent_retryable' &&
        row.attemptCount < DELIVERY_MAX_ATTEMPTS &&
        row.expiresAt > now
      ) {
        data = {
          ...base,
          status: 'PENDING',
          availableAt: new Date(
            Math.min(row.expiresAt.getTime(), now.getTime() + outboxRetryDelayMs(row.attemptCount)),
          ),
          lastErrorCode: 'RETRYABLE_NOT_SENT',
        };
      } else if (outcome === 'not_sent_retryable' || outcome === 'not_sent_permanent') {
        data = {
          ...base,
          status: 'DEAD_LETTER',
          finishedAt: now,
          lastErrorCode:
            outcome === 'not_sent_permanent' ? 'PERMANENT_NOT_SENT' : 'ATTEMPTS_EXHAUSTED',
        };
      } else {
        data = {
          ...base,
          status: 'UNKNOWN',
          finishedAt: now,
          lastErrorCode: 'SEND_OUTCOME_UNKNOWN',
        };
      }
      await tx.notificationDelivery.update({ where: { id: row.id }, data });
      return 'recorded';
    });
  }
}
