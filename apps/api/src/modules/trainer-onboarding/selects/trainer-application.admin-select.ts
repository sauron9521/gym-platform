import type { Prisma } from '#prisma/client';

/** Only the authorized operator dashboard may receive reviewer/applicant IDs. */
export const trainerApplicationAdminSelect = {
  id: true,
  userId: true,
  status: true,
  applicantNote: true,
  reviewReason: true,
  reviewerId: true,
  reviewedAt: true,
  revokedById: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.TrainerApplicationSelect;
