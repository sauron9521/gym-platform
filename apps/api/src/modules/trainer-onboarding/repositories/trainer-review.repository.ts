import { Injectable } from '@nestjs/common';

import { Prisma, type TrainerApplicationStatus } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';

import { trainerApplicationAdminSelect } from '../selects/trainer-application.admin-select.js';

export type TrainerReviewAction = 'APPROVE' | 'REJECT' | 'REVOKE';

@Injectable()
export class TrainerReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isCurrentAdmin(reviewerId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true, deletedAt: true },
    });
    return !!user && user.role === 'ADMIN' && user.deletedAt === null;
  }

  findPending() {
    return this.prisma.trainerApplication.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: trainerApplicationAdminSelect,
    });
  }

  decide(applicationId: string, reviewerId: string, action: TrainerReviewAction, reason: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Validate the administrator from the database, not from a potentially
        // stale bearer/session role claim.
        const admin = await tx.user.findUnique({
          where: { id: reviewerId },
          select: { role: true, deletedAt: true },
        });
        if (!admin || admin.deletedAt || admin.role !== 'ADMIN') {
          return { kind: 'forbidden' } as const;
        }

        const application = await tx.trainerApplication.findUnique({
          where: { id: applicationId },
          include: {
            applicant: {
              select: {
                role: true,
                deletedAt: true,
                emailVerified: true,
                trainerProfile: { select: { isActive: true } },
              },
            },
          },
        });
        if (!application) return { kind: 'missing' } as const;
        if (application.userId === reviewerId) return { kind: 'forbidden' } as const;

        // Retry is a true no-op only for identical actor+decision+reason.
        const desired: TrainerApplicationStatus =
          action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'REVOKED';
        if (application.status === desired) {
          const actor = action === 'REVOKE' ? application.revokedById : application.reviewerId;
          const storedReason =
            action === 'REVOKE' ? application.revokeReason : application.reviewReason;
          if (actor === reviewerId && storedReason === reason) {
            const existing = await tx.trainerApplication.findUniqueOrThrow({
              where: { id: applicationId },
              select: trainerApplicationAdminSelect,
            });
            return { kind: 'ok', record: existing } as const;
          }
          return { kind: 'conflict' } as const;
        }

        const previous = action === 'REVOKE' ? 'APPROVED' : 'PENDING';
        if (application.status !== previous) return { kind: 'conflict' } as const;

        if (
          action !== 'REVOKE' &&
          (application.applicant.deletedAt ||
            application.applicant.role !== 'ATHLETE' ||
            !application.applicant.emailVerified ||
            application.applicant.trainerProfile?.isActive)
        ) {
          return { kind: 'conflict' } as const;
        }

        if (action === 'REVOKE' && !application.applicant.trainerProfile?.isActive) {
          return { kind: 'conflict' } as const;
        }

        const now = new Date();
        const decisionData =
          action === 'REVOKE'
            ? { status: desired, revokedById: reviewerId, revokedAt: now, revokeReason: reason }
            : { status: desired, reviewerId, reviewedAt: now, reviewReason: reason };
        const changed = await tx.trainerApplication.updateMany({
          where: { id: applicationId, status: previous },
          data: decisionData,
        });
        if (changed.count !== 1) return { kind: 'conflict' } as const;

        if (action === 'APPROVE') {
          await tx.trainerProfile.upsert({
            where: { userId: application.userId },
            create: {
              userId: application.userId,
              isActive: true,
              approvedById: reviewerId,
              approvedAt: now,
            },
            update: {
              isActive: true,
              approvedById: reviewerId,
              approvedAt: now,
              revokedById: null,
              revokedAt: null,
            },
          });
        }
        if (action === 'REVOKE') {
          const profile = await tx.trainerProfile.updateMany({
            where: { userId: application.userId, isActive: true },
            data: { isActive: false, revokedAt: now, revokedById: reviewerId },
          });
          if (profile.count !== 1) {
            // Returning a conflict would COMMIT the application update. Throw
            // to roll back the whole serializable transaction instead.
            throw new Error('Trainer profile revocation invariant violated');
          }
        }

        const record = await tx.trainerApplication.findUniqueOrThrow({
          where: { id: applicationId },
          select: trainerApplicationAdminSelect,
        });
        return { kind: 'ok', record } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
