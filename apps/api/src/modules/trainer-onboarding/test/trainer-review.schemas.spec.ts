import { describe, expect, it } from 'vitest';

import {
  trainerReviewApplicationIdSchema,
  trainerReviewDecisionSchema,
} from '../dto/trainer-review.schemas.js';

describe('trainer operator review payload', () => {
  it('trims a bounded audit reason', () => {
    expect(trainerReviewDecisionSchema.parse({ reason: '  Credentials verified  ' })).toEqual({
      reason: 'Credentials verified',
    });
  });

  it.each([
    {},
    { reason: '' },
    { reason: 'short' },
    { reason: 'x'.repeat(501) },
    { reason: 'Credentials verified', status: 'APPROVED' },
    { reason: 'Credentials verified', userId: 'other' },
    { reason: 'Credentials verified', reviewerId: 'other' },
    { reason: 'Credentials verified', role: 'TRAINER' },
  ])('rejects malformed or privilege-bearing data', (payload) => {
    expect(trainerReviewDecisionSchema.safeParse(payload).success).toBe(false);
  });

  it('requires an actual application UUID', () => {
    expect(trainerReviewApplicationIdSchema.safeParse('not-uuid').success).toBe(false);
  });
});
