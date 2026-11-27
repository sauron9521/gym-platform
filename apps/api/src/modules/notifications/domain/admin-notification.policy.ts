import type { Prisma } from '#prisma/client';
import { hasAdminPermission } from '#src/common/rbac/admin-permissions';
import { parseOperatorSuperAdminIds } from '#src/common/rbac/operator-superadmin-allowlist';
import { adminReviewEventType } from './outbox-event.policy.js';

export function reviewOperatorIds(config: unknown): string[] {
  const ids = parseOperatorSuperAdminIds(config);
  return [...ids]
    .filter((id) => hasAdminPermission('ADMIN', 'admin.accounts.manage', id, ids))
    .sort();
}

export const pendingReviewSource: Prisma.TrainerApplicationWhereInput = {
  status: 'PENDING',
  applicant: {
    is: {
      status: 'ACTIVE',
      deletedAt: null,
      role: 'ATHLETE',
      emailVerified: true,
      OR: [{ trainerProfile: null }, { trainerProfile: { is: { isActive: false } } }],
    },
  },
};

export function adminInboxWhere(recipientId: string, now: Date): Prisma.NotificationWhereInput {
  return {
    recipientId,
    scope: 'ADMIN',
    category: 'ACCOUNT',
    type: adminReviewEventType,
    templateKey: adminReviewEventType,
    recipient: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    trainerRelationshipId: null,
    programAssignmentId: null,
    resourceType: null,
    resourceId: null,
    trainerApplication: { is: pendingReviewSource },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}
