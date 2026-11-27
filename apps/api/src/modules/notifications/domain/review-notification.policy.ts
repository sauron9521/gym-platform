import type { Prisma } from '#prisma/client';
import { reviewEventTypes, type ReviewEventType } from './outbox-event.policy.js';

export function reviewSourceWhere(
  type: ReviewEventType,
  recipientId: string,
): Prisma.TrainerApplicationWhereInput {
  return {
    userId: recipientId,
    applicant: { is: { status: 'ACTIVE', deletedAt: null, role: { not: 'ADMIN' } } },
    ...(type === 'trainer.application.revoked'
      ? { status: 'REVOKED', revokedAt: { not: null }, revokedById: { not: null } }
      : {
          status: { in: ['APPROVED', 'REJECTED'] },
          reviewedAt: { not: null },
          reviewerId: { not: null },
          revokedAt: null,
        }),
  };
}

export function reviewInboxWhere(recipientId: string): Prisma.NotificationWhereInput[] {
  return reviewEventTypes.map((type) => ({
    type,
    category: 'ACCOUNT',
    templateKey: type,
    trainerRelationshipId: null,
    programAssignmentId: null,
    trainerApplication: { is: reviewSourceWhere(type, recipientId) },
    resourceType: null,
    resourceId: null,
  }));
}
