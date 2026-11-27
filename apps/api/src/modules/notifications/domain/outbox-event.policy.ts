import { z } from 'zod';

// Explicit versioned variants with bounded routing payloads.
const securityAction = z.enum([
  'FIRST_TOTP_CONFIRMED',
  'ADMIN_RECOVERY_CHALLENGE_VERIFIED',
  'ADMIN_RECOVERY_CODES_REGENERATED',
  'ADMIN_TOTP_REPLACEMENT_STAGED',
  'ADMIN_TOTP_REPLACEMENT_CONFIRMED',
]);

const accountSecurityEvent = z.strictObject({
  type: z.literal('account.security.changed'),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('MfaLifecycleAudit'), id: z.uuid() }),
    context: z.strictObject({ userId: z.uuid(), action: securityAction }),
  }),
});

export const trainerEventTypes = [
  'trainer.invitation.created',
  'trainer.invitation.accepted',
  'trainer.invitation.declined',
  'trainer.invitation.cancelled',
  'trainer.relationship.terminated',
] as const;
export type TrainerEventType = (typeof trainerEventTypes)[number];

const trainerRelationshipEvent = z.strictObject({
  type: z.enum(trainerEventTypes),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('TrainerAthlete'), id: z.uuid() }),
  }),
});

export const programEventTypes = [
  'program.assigned',
  'program.assignment.cancelled',
  'program.assignment.terminated',
  'program.assignment.completed',
] as const;
export type ProgramEventType = (typeof programEventTypes)[number];

const programAssignmentEvent = z.strictObject({
  type: z.enum(programEventTypes),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('TrainingProgramAssignment'), id: z.uuid() }),
  }),
});

export const reviewEventTypes = [
  'trainer.application.reviewed',
  'trainer.application.revoked',
] as const;
export type ReviewEventType = (typeof reviewEventTypes)[number];
const trainerReviewEvent = z.strictObject({
  type: z.enum(reviewEventTypes),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('TrainerApplication'), id: z.uuid() }),
  }),
});

export const adminReviewEventType = 'admin.trainer.review.required' as const;
const adminReviewEvent = z.strictObject({
  type: z.literal(adminReviewEventType),
  schemaVersion: z.literal(1),
  occurredAt: z.date(),
  actorUserId: z.uuid(),
  payload: z.strictObject({
    aggregate: z.strictObject({ kind: z.literal('TrainerApplication'), id: z.uuid() }),
  }),
});

export const inboxEventTypes = [
  'account.security.changed',
  ...trainerEventTypes,
  ...programEventTypes,
  ...reviewEventTypes,
] as const;

export const outboxEventSchema = z
  .discriminatedUnion('type', [
    accountSecurityEvent,
    trainerRelationshipEvent,
    programAssignmentEvent,
    trainerReviewEvent,
    adminReviewEvent,
  ])
  .refine(
    (event) =>
      event.type !== 'account.security.changed' ||
      event.actorUserId === event.payload.context.userId,
    {
      message: 'Event actor and account must match',
    },
  );

export type OutboxEventInput = z.input<typeof outboxEventSchema>;
export type ValidatedOutboxEvent = z.output<typeof outboxEventSchema>;

export function outboxEventKey(event: ValidatedOutboxEvent): string {
  return event.type === 'account.security.changed'
    ? `mfa-lifecycle:${event.payload.aggregate.id}:v1`
    : event.payload.aggregate.kind === 'TrainerAthlete'
      ? `trainer-relationship:${event.payload.aggregate.id}:${event.type}:v1`
      : event.payload.aggregate.kind === 'TrainerApplication'
        ? `trainer-application:${event.payload.aggregate.id}:${event.type}:v1`
        : `program-assignment:${event.payload.aggregate.id}:${event.type}:v1`;
}

export function isProgramAssignmentEvent(
  event: ValidatedOutboxEvent,
): event is Extract<ValidatedOutboxEvent, { type: ProgramEventType }> {
  return event.payload.aggregate.kind === 'TrainingProgramAssignment';
}

export function isTrainerReviewEvent(
  event: ValidatedOutboxEvent,
): event is Extract<ValidatedOutboxEvent, { type: ReviewEventType }> {
  return (
    event.type === 'trainer.application.reviewed' || event.type === 'trainer.application.revoked'
  );
}
