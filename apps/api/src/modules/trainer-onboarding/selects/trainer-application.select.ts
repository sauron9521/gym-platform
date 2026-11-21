import type { Prisma } from '#prisma/client';

/** Explicit owner-visible projection: never return moderator identity or account data. */
export const trainerApplicationOwnSelect = {
  id: true,
  status: true,
  applicantNote: true,
  reviewReason: true,
  reviewedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.TrainerApplicationSelect;
