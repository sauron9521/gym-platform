import type { TrainerApplicationStatus } from '#prisma/client';

export type TrainerReviewAction = 'APPROVE' | 'REJECT' | 'REVOKE';

/**
 * An application decision is a reviewed transition, never a direct privilege grant.
 * Resubmission creates a *new* application after a terminal decision.
 */
export function nextTrainerApplicationStatus(
  current: TrainerApplicationStatus,
  action: TrainerReviewAction,
): TrainerApplicationStatus {
  if (current === 'PENDING' && action === 'APPROVE') return 'APPROVED';
  if (current === 'PENDING' && action === 'REJECT') return 'REJECTED';
  if (current === 'APPROVED' && action === 'REVOKE') return 'REVOKED';

  throw new Error('Invalid trainer application status transition');
}
